import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { toEconomics } from '@/api/mappers/economics'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { localStateFromApi, toProject } from '@/api/mappers/project'
import { toSimulationRun } from '@/api/mappers/simulation'
import { toSimulationTrace } from '@/api/mappers/trace'
import {
  applyInputsPatch,
  canAdvanceTo,
  canOpenStep,
  furthestStep,
  markFresh,
  matchingStaleCause,
  stepAfterMatchingStale,
  type CalcParams,
  type ConditionRow,
  type DraftProject,
  type MatchingEvaluation,
  type ParamsProcessEntry,
  type Project,
  type ProjectInputs,
  type SavedProject,
  type SimulationJob,
} from '@/domain'
import { SITE_PARAMETERS } from '@/mocks/fixtures/siteParameters'
import { ConflictError, NotFoundError } from '../errors'
import type { CatalogService } from '../catalog'
import type { LocationService } from '../locations'
import type { ProcessService } from '../processes'
import type { ProjectService } from '../projects'

type ProjectDto = ApiSchemas['Project']
type EvaluationDto = ApiSchemas['Evaluation']
type SimulationRunDto = ApiSchemas['SimulationRun']

const READ_ONLY = 'Сохранённая оценка открывается только для просмотра — измените её в новом проекте на её основе'
const now = (): string => new Date().toISOString()

/** Поля «Параметров расчёта» экрана и API совпадают по именам; пустое поле — исходное значение. */
const CALC_FIELDS: readonly (keyof CalcParams)[] = [
  'staffCostRubPerMonth', 'workHoursPerDay', 'robotTripsPerHour', 'robotPriceRub', 'serviceCostRubPerYear', 'utilization', 'horizonYears',
]

/**
 * Исходные значения панели. Без часов работы и горизонта панель не показать; поля робота, которых нет в каталоге
 * и в расчёте, — 0 (пользователь вводит своё значение).
 */
function calcDefaultsOf(dto: EvaluationDto): CalcParams | null {
  const d = dto.calcDefaults
  if (d?.workHoursPerDay == null || d.horizonYears == null) return null
  return Object.fromEntries(CALC_FIELDS.map((key) => [key, d[key] ?? 0])) as unknown as CalcParams
}

/** Допущения расчёта выбранного решения → реестр условий итога (PRD 11.5). */
function conditionsOf(dto: EvaluationDto, solutionId: string): readonly ConditionRow[] {
  const result = dto.candidates?.flatMap((c) => c.results ?? []).find((r) => r.solutionId === solutionId)
  return (result?.details?.assumptions ?? []).map((a) => ({
    parameter: a.label ?? a.code ?? '',
    value: [a.value, a.unit].filter((part) => part != null && part !== '').join(' '),
    status: 'assumption',
    source: 'Норматив модели RAV5',
    acquisition: null,
    blocksConclusion: false,
    impact: 'Значение принято по нормативу — цифры итога условные',
    howToConfirm: 'Уточните значение в профиле локации или у поставщика и пересчитайте подбор',
  }))
}

const JOB_STATUS: Readonly<Record<string, SimulationJob['status']>> = { queued: 'queued', running: 'running', done: 'done', error: 'error', cancelled: 'error' }

function jobOf(dto: SimulationRunDto): SimulationJob {
  return {
    id: dto.id,
    status: JOB_STATUS[dto.status] ?? 'error',
    log: dto.log ?? [],
    elapsedS: dto.elapsedS,
    // Прогон экрана — прогон api: результат и трассы читаются по его id.
    runId: dto.status === 'done' ? dto.id : null,
    error: dto.error ?? (dto.errors?.map((e) => e.message).join('; ') || null),
  }
}

interface Dependencies {
  readonly catalog: Pick<CatalogService, 'getRobot' | 'listOperationClasses' | 'listHandlingMethods'>
  readonly locations: Pick<LocationService, 'getLocation' | 'listLocationProcesses' | 'listFacilityParameters'>
  readonly processes: Pick<ProcessService, 'listProcesses'>
}

/**
 * Проекты оценки (PRD 11) поверх оркестратора services/api. Решения по шагам — `project.inputs` в модели экрана,
 * правило «что устаревает» (D-89) применяет фронт; выбор варианта, «Параметры расчёта», прогоны и сохранение — API.
 */
export function apiProjects(http: HttpClient, deps: Dependencies): Partial<ProjectService> {
  const getDto = (id: string) => http.get<ProjectDto>(`/projects/${id}`)
  const toDomain = (dto: ProjectDto): Project => toProject(dto, localStateFromApi(dto))
  const editableDto = async (id: string): Promise<ProjectDto> => {
    const dto = await getDto(id)
    if (dto.status === 'saved') throw new ConflictError(READ_ONLY, 'project_saved')
    return dto
  }
  const patch = async (id: string, body: ApiSchemas['ProjectPatchInput']): Promise<Project> =>
    toDomain(await http.patch<ProjectDto>(`/projects/${id}`, body))

  /** Выбор варианта живёт и в решениях шага, и в проекте API: сохранение и симуляция берут его из проекта. */
  const putSelection = async (id: string, inputs: ProjectInputs) => {
    const selection = inputs.matching?.selection
    try {
      await http.put(`/projects/${id}/selection`, selection
        ? { solutionId: selection.solutionId, acquisitionModel: selection.acquisition }
        : { solutionId: null })
    } catch (error: unknown) {
      // Расчёт устарел: выбор запишется после пересчёта (evaluate переносит его на новый результат).
      if (!(error instanceof ConflictError)) throw error
    }
  }

  const matchingOf = (dto: EvaluationDto, inputs: ProjectInputs): MatchingEvaluation => {
    const evaluation = toMatchingEvaluation(dto, calcDefaultsOf(dto))
    return { ...evaluation, stale: evaluation.stale || inputs.stale.matching }
  }

  const syncManual = async (id: string, wanted: readonly string[]) => {
    const current = (await http.get<ApiSchemas['ManualList']>(`/projects/${id}/manual-candidates`)).items ?? []
    const have = new Set(current.map((m) => m.solutionId))
    await Promise.all([
      ...wanted.filter((s) => !have.has(s)).map((solutionId) => http.post(`/projects/${id}/manual-candidates`, { solutionId })),
      ...current.filter((m) => m.solutionId && !wanted.includes(m.solutionId)).map((m) => http.delete(`/projects/${id}/manual-candidates/${m.solutionId ?? ''}`)),
    ])
  }

  return {
    listProjects: async () => {
      const page = await http.get<ApiSchemas['ProjectPage']>('/projects', { limit: 500 })
      return (page.items ?? []).filter((p) => !p.isDemo).map(toDomain).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    getProject: async (id) => toDomain(await getDto(id)),

    createDraft: async ({ name, locationId, locationProcessId, solutionId }) => {
      // В проекте API ровно одна задача: без выбранного процесса черновик начинается с первого процесса локации (шаг 1 его сменит).
      const taskId = locationProcessId ?? (await deps.locations.listLocationProcesses(locationId))[0]?.id
      if (!taskId) throw new ConflictError('На локации нет процессов — добавьте процесс, чтобы оценить его роботизацию')
      const dto = await http.post<ProjectDto>('/projects', { name, locationId, taskId, ...(solutionId ? { pinnedSolutionId: solutionId } : {}) })
      return toDomain(dto) as DraftProject
    },

    updateInputs: async (id, inputsPatch) => {
      const dto = await editableDto(id)
      const current = toDomain(dto)
      const inputs = applyInputsPatch(localStateFromApi(dto).inputs, inputsPatch, now())
      const step = stepAfterMatchingStale(current.step, matchingStaleCause(inputsPatch, inputs))
      const project = await patch(id, step === current.step ? { inputs } : { inputs, step })
      if (inputsPatch.matching && 'selection' in inputsPatch.matching) await putSelection(id, inputs)
      return project
    },

    getParamsSnapshot: async (id) => {
      const dto = await getDto(id)
      const locationId = dto.locationId ?? ''
      const [location, locationProcesses, processes, classes, handlingMethods] = await Promise.all([
        deps.locations.getLocation(locationId),
        deps.locations.listLocationProcesses(locationId),
        deps.processes.listProcesses(),
        deps.catalog.listOperationClasses(),
        deps.catalog.listHandlingMethods(),
      ])
      const facilityParameters = await deps.locations.listFacilityParameters(location.facilityType)
      const entries = locationProcesses.flatMap((locationProcess): ParamsProcessEntry[] => {
        const process = processes.find((p) => p.code === locationProcess.processCode)
        return process ? [{ locationProcess, process, operationClass: classes.find((c) => c.code === process.operationClass) ?? null }] : []
      })
      const pinned = dto.status === 'draft' && dto.pinnedSolutionId
        ? await deps.catalog.getRobot(dto.pinnedSolutionId).then((r) => ({ id: r.id, name: r.name }), () => null)
        : null
      const siteValues = Object.fromEntries(SITE_PARAMETERS.flatMap((p) => [p.code, p.pairCode]).filter((code): code is string => Boolean(code))
        .flatMap((code) => (location.parameters[code] ? [[code, location.parameters[code]]] : [])))
      return { location, facilityParameters, siteParameters: SITE_PARAMETERS, siteValues, processes: entries, handlingMethods, pinnedSolution: pinned }
    },

    selectProcess: async (id, locationProcessId) => {
      const dto = await editableDto(id)
      if (dto.task?.id === locationProcessId) return toDomain(dto)
      return patch(id, { taskId: locationProcessId })
    },

    openStep: async (id, step) => {
      const project = toDomain(await getDto(id))
      if (!canOpenStep(project, step) && !canAdvanceTo(project, step)) {
        throw new ConflictError('Этот шаг откроется, когда будут пройдены предыдущие')
      }
      if (project.status !== 'draft') return project
      const next = furthestStep(project.step, step)
      return next === project.step ? project : patch(id, { step: next })
    },

    getMatching: async (id) => {
      const [evaluation, dto] = await Promise.all([http.get<EvaluationDto>(`/projects/${id}/evaluation`), getDto(id)])
      return matchingOf(evaluation, localStateFromApi(dto).inputs)
    },

    evaluateMatching: async (id) => {
      const dto = await editableDto(id)
      const { inputs } = localStateFromApi(dto)
      const matching = inputs.matching
      if (matching) await syncManual(id, matching.manualSolutionIds)
      const solutionId = matching?.selection?.solutionId
      const evaluation = await http.post<EvaluationDto>(`/projects/${id}/evaluate`, {
        calcOverrides: { ...matching?.calcParams, ...(solutionId ? { solutionId } : {}) },
      })
      const fresh = markFresh(inputs, 'matching', now())
      await patch(id, { inputs: fresh })
      return matchingOf(evaluation, fresh)
    },

    startSimulation: async (id, request) => {
      await editableDto(id)
      const run = await http.post<SimulationRunDto>(`/projects/${id}/simulation-runs`, { fleet: request.fleet, conditions: request.conditions })
      return jobOf(run)
    },

    getSimulationJob: async (jobId) => jobOf(await http.get<SimulationRunDto>(`/simulation-runs/${jobId}`)),

    getSimulationRun: async (runId) => {
      const dto = await http.get(`/simulation-runs/${runId}/result`)
      // Результат — тело services/simulation (`simulation_id`). Трассы читаются по id прогона api.
      return { ...toSimulationRun(dto), id: runId }
    },

    getSimulationTraces: async (runId) => {
      const traces = await http.get<readonly unknown[]>(`/simulation-runs/${runId}/traces`)
      return traces.map(toSimulationTrace)
    },

    getEconomics: async (id) => {
      const [dto, evaluation, snapshot] = await Promise.all([
        getDto(id), http.get<EvaluationDto>(`/projects/${id}/evaluation`), http.get<ApiSchemas['ProjectSnapshot']>(`/projects/${id}/snapshot`),
      ])
      const solutionId = localStateFromApi(dto).inputs.matching?.selection?.solutionId ?? dto.selection?.solutionId
      if (!solutionId) throw new NotFoundError('Итог появится, когда на подборе выбран вариант')
      return toEconomics(evaluation, solutionId, {
        conditions: conditionsOf(evaluation, solutionId),
        operationsPerDay: snapshot.task?.params?.dailyVolume ?? 0,
        baselineOpexRubPerYear: snapshot.task?.derived?.basePayrollRubYear ?? null,
      })
    },

    requestQuote: async (id) => toDomain(await http.post<ProjectDto>(`/projects/${id}/quote-request`)),

    save: async (id) => {
      const dto = await editableDto(id)
      const { inputs } = localStateFromApi(dto)
      const selection = inputs.matching?.selection
      if (!selection) throw new ConflictError('Сохранить можно, когда на подборе выбран вариант', 'selection_required')
      const scenario = inputs.economics?.scenario ?? selection.acquisition
      const economics = await http.get<EvaluationDto>(`/projects/${id}/evaluation`)
        .then((ev) => toEconomics(ev, selection.solutionId, { conditions: [], operationsPerDay: 0, baselineOpexRubPerYear: 0 }))
      if (economics.scenarios.find((s) => s.acquisition === scenario)?.paybackYears == null) {
        throw new ConflictError('У выбранного сценария нет окупаемости — сохранить нельзя', 'no_payback')
      }
      await http.put(`/projects/${id}/selection`, { solutionId: selection.solutionId, acquisitionModel: scenario })
      await patch(id, { step: 'economics' })
      return toDomain(await http.post<ProjectDto>(`/projects/${id}/save`)) as SavedProject
    },
  }
}
