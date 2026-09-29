import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { toEconomics } from '@/api/mappers/economics'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { localStateFromApi, toProject } from '@/api/mappers/project'
import { toSimulationRun } from '@/api/mappers/simulation'
import { toSimulationTrace } from '@/api/mappers/trace'
import {
  applyInputsPatch,
  type AcquisitionModel,
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
  type ProjectSelection,
  type SavedProject,
  type SimulationJob,
} from '@/domain'
import { siteParameterDefs, siteValuesFromParameters } from '@/domain'
import { ConflictError, NotFoundError } from '../errors'
import type { CatalogService } from '../catalog'
import type { LocationService } from '../locations'
import type { ProcessService } from '../processes'
import type { ProjectService } from '../projects'
import { widthMarginM } from './processes'
import { createDemoSession, type DemoSession, type DemoState } from './demoSession'

type ProjectDto = ApiSchemas['Project']
type EvaluationDto = ApiSchemas['Evaluation']
type SimulationRunDto = ApiSchemas['SimulationRun']
type PreviewRunDto = ApiSchemas['PreviewSimulationRun']

const READ_ONLY = 'Сохранённая оценка открывается только для просмотра — измените её в новом проекте на её основе'
const DEMO_NOT_SAVED = 'Демо-проект не сохраняется — войдите, чтобы сохранить оценку в своём кабинете'
/** Задание services/simulation из гостевого прогона демо-проекта; у прогона api id — UUID с дефисами. */
const PREVIEW_JOB = /^[0-9a-f]{32}$/u
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

/** Гостевой прогон демо-проекта: id — задание services/simulation, результат и трассы читаются по нему же. */
function previewJobOf(dto: PreviewRunDto): SimulationJob {
  return {
    id: dto.id,
    status: JOB_STATUS[dto.status] ?? 'error',
    log: dto.log ?? [],
    elapsedS: dto.elapsedS,
    runId: dto.status === 'done' ? dto.id : null,
    error: dto.error ?? (dto.errors?.map((e) => e.message).join('; ') || null),
  }
}

/** Выбор варианта из проекта API: у демо-проекта его ставит сид. */
function selectionOf(dto: ProjectDto): ProjectSelection | null {
  const selected = dto.selection
  if (!selected?.solutionId) return null
  return { solutionId: selected.solutionId, acquisition: (selected.acquisitionModel ?? 'purchase') as AcquisitionModel }
}

interface Dependencies {
  readonly catalog: Pick<CatalogService, 'getRobot' | 'listOperationClasses' | 'listHandlingMethods'>
  readonly locations: Pick<LocationService, 'getLocation' | 'listLocationProcesses' | 'listFacilityParameters'>
  readonly processes: Pick<ProcessService, 'listProcesses'>
  /** Решения гостя по демо-проектам; по умолчанию — вкладка браузера. */
  readonly demo?: DemoSession
}

/**
 * Проекты оценки (PRD 11) поверх оркестратора services/api. Решения по шагам — `project.inputs` в модели экрана,
 * правило «что устаревает» (D-89) применяет фронт; выбор варианта, «Параметры расчёта», прогоны и сохранение — API.
 */
export function apiProjects(http: HttpClient, deps: Dependencies): Partial<ProjectService> {
  const demo = deps.demo ?? createDemoSession()
  const getDto = (id: string) => http.get<ProjectDto>(`/projects/${id}`)

  /**
   * Демо-проект (ролевая модель, §5): решения гостя — в браузере, поверх того, что положил сид (выбранный вариант
   * подбора и его сценарий итога). Сервер демо-проект не меняет.
   */
  const demoState = (dto: ProjectDto): DemoState => {
    const kept = demo.get(dto.id ?? '')
    if (kept) return kept
    const inputs = localStateFromApi(dto).inputs
    const selection = inputs.matching?.selection ?? selectionOf(dto)
    if (!selection) return { inputs, evaluation: null }
    return {
      evaluation: null,
      inputs: {
        ...inputs,
        matching: { calcParams: {}, manualSolutionIds: [], ...inputs.matching, selection },
        economics: inputs.economics ?? { scenario: selection.acquisition },
      },
    }
  }
  const toDomain = (dto: ProjectDto): Project => {
    const local = localStateFromApi(dto)
    return toProject(dto, dto.isDemo === true ? { ...local, inputs: demoState(dto).inputs } : local)
  }
  const editableDto = async (id: string): Promise<ProjectDto> => {
    const dto = await getDto(id)
    if (dto.status === 'saved') throw new ConflictError(READ_ONLY, 'project_saved')
    return dto
  }
  /** Оценка, на которой стоят шаги: пересчёт гостя или расчёт из сида. */
  const evaluationOf = async (dto: ProjectDto): Promise<EvaluationDto> =>
    (dto.isDemo === true ? demoState(dto).evaluation : null) ?? http.get<EvaluationDto>(`/projects/${dto.id ?? ''}/evaluation`)
  const calcOverridesOf = (inputs: ProjectInputs) => {
    const matching = inputs.matching
    const solutionId = matching?.selection?.solutionId
    return { ...matching?.calcParams, ...(solutionId ? { solutionId } : {}) }
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

  /** Прогон api или гостевой прогон демо-проекта: у второго свои пути. */
  const runPath = (runId: string): string => PREVIEW_JOB.test(runId) ? `/preview/simulation-runs/${runId}` : `/simulation-runs/${runId}`

  const syncManual = async (id: string, wanted: readonly string[]) => {
    const current = (await http.get<ApiSchemas['ManualList']>(`/projects/${id}/manual-candidates`)).items ?? []
    const have = new Set(current.map((m) => m.solutionId))
    await Promise.all([
      ...wanted.filter((s) => !have.has(s)).map((solutionId) => http.post(`/projects/${id}/manual-candidates`, { solutionId })),
      ...current.filter((m) => m.solutionId && !wanted.includes(m.solutionId)).map((m) => http.delete(`/projects/${id}/manual-candidates/${m.solutionId ?? ''}`)),
    ])
  }

  return {
    listProjects: async (options) => {
      const page = await http.get<ApiSchemas['ProjectPage']>('/projects', { limit: 500 })
      return (page.items ?? [])
        .filter((p) => (p.isDemo === true) === (options?.demo === true))
        .map(toDomain)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
      if (dto.isDemo === true) {
        const state = demoState(dto)
        demo.set(id, { ...state, inputs: applyInputsPatch(state.inputs, inputsPatch, now()) })
        return toDomain(dto)
      }
      // editableDto отсекает сохранённую оценку: здесь черновик.
      const current = toDomain(dto) as DraftProject
      const inputs = applyInputsPatch(localStateFromApi(dto).inputs, inputsPatch, now())
      const step = stepAfterMatchingStale(current.step, matchingStaleCause(inputsPatch, inputs))
      const project = await patch(id, step === current.step ? { inputs } : { inputs, step })
      if (inputsPatch.matching && 'selection' in inputsPatch.matching) await putSelection(id, inputs)
      return project
    },

    getParamsSnapshot: async (id) => {
      const dto = await getDto(id)
      const locationId = dto.locationId ?? ''
      const [location, locationProcesses, processes, classes, handlingMethods, margin] = await Promise.all([
        deps.locations.getLocation(locationId),
        deps.locations.listLocationProcesses(locationId),
        deps.processes.listProcesses(),
        deps.catalog.listOperationClasses(),
        deps.catalog.listHandlingMethods(),
        widthMarginM(http),
      ])
      const facilityParameters = await deps.locations.listFacilityParameters(location.facilityType)
      const entries = locationProcesses.flatMap((locationProcess): ParamsProcessEntry[] => {
        const process = processes.find((p) => p.code === locationProcess.processCode)
        return process ? [{ locationProcess, process, operationClass: classes.find((c) => c.code === process.operationClass) ?? null }] : []
      })
      const pinned = dto.status === 'draft' && dto.pinnedSolutionId
        ? await deps.catalog.getRobot(dto.pinnedSolutionId).then((r) => ({ id: r.id, name: r.name }), () => null)
        : null
      const siteParameters = siteParameterDefs(facilityParameters)
      return {
        location, facilityParameters, siteParameters,
        siteValues: siteValuesFromParameters(location.parameters, siteParameters),
        processes: entries, handlingMethods, pinnedSolution: pinned, widthMarginM: margin,
      }
    },

    selectProcess: async (id, locationProcessId) => {
      const dto = await editableDto(id)
      if (dto.task?.id === locationProcessId) return toDomain(dto)
      if (dto.isDemo === true) throw new ConflictError('В демо-проекте процесс не меняется — войдите, чтобы оценить свой', 'demo_read_only')
      return patch(id, { taskId: locationProcessId })
    },

    openStep: async (id, step) => {
      const project = toDomain(await getDto(id))
      if (!canOpenStep(project, step) && !canAdvanceTo(project, step)) {
        throw new ConflictError('Этот шаг откроется, когда будут пройдены предыдущие')
      }
      if (project.status !== 'draft' || project.isDemo === true) return project
      const next = furthestStep(project.step, step)
      return next === project.step ? project : patch(id, { step: next })
    },

    getMatching: async (id) => {
      const dto = await getDto(id)
      return matchingOf(await evaluationOf(dto), toDomain(dto).inputs)
    },

    evaluateMatching: async (id) => {
      const dto = await editableDto(id)
      if (dto.isDemo === true) {
        // Гость пересчитывает демо-проект без записи (роли, §5): цифры — в браузере до закрытия вкладки.
        const { inputs } = demoState(dto)
        const evaluation = await http.post<EvaluationDto>(`/projects/${id}/preview`, { calcOverrides: calcOverridesOf(inputs) })
        const fresh = markFresh(inputs, 'matching', now())
        demo.set(id, { inputs: fresh, evaluation })
        return matchingOf(evaluation, fresh)
      }
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
      const dto = await editableDto(id)
      if (dto.isDemo === true) {
        const { inputs } = demoState(dto)
        const selection = inputs.matching?.selection
        if (!selection) throw new ConflictError('Выберите вариант на шаге «Подбор» — симуляция проверяет выбранную конфигурацию', 'selection_required')
        const run = await http.post<PreviewRunDto>(`/projects/${id}/preview/simulation-runs`, {
          calcOverrides: calcOverridesOf(inputs), solutionId: selection.solutionId, acquisitionModel: selection.acquisition,
          fleet: request.fleet, conditions: request.conditions,
        })
        return previewJobOf(run)
      }
      const run = await http.post<SimulationRunDto>(`/projects/${id}/simulation-runs`, { fleet: request.fleet, conditions: request.conditions })
      return jobOf(run)
    },

    getSimulationJob: async (jobId) => PREVIEW_JOB.test(jobId)
      ? previewJobOf(await http.get<PreviewRunDto>(`/preview/simulation-runs/${jobId}`))
      : jobOf(await http.get<SimulationRunDto>(`/simulation-runs/${jobId}`)),

    getSimulationRun: async (runId) => {
      const dto = await http.get<Parameters<typeof toSimulationRun>[0]>(`${runPath(runId)}/result`)
      // Результат — тело services/simulation (`simulation_id`). Трассы читаются по id прогона api.
      return { ...toSimulationRun(dto), id: runId }
    },

    getSimulationTraces: async (runId) => {
      const traces = await http.get<readonly unknown[]>(`${runPath(runId)}/traces`)
      return traces.map(toSimulationTrace)
    },

    getEconomics: async (id) => {
      const [dto, snapshot] = await Promise.all([getDto(id), http.get<ApiSchemas['ProjectSnapshot']>(`/projects/${id}/snapshot`)])
      const evaluation = await evaluationOf(dto)
      const solutionId = toDomain(dto).inputs.matching?.selection?.solutionId ?? dto.selection?.solutionId
      if (!solutionId) throw new NotFoundError('Итог появится, когда на подборе выбран вариант')
      return toEconomics(evaluation, solutionId, {
        conditions: conditionsOf(evaluation, solutionId),
        operationsPerDay: snapshot.task?.params?.dailyVolume ?? 0,
        baselineOpexRubPerYear: snapshot.task?.derived?.basePayrollRubYear ?? null,
      })
    },

    requestQuote: async (id) => {
      if ((await getDto(id)).isDemo === true) throw new ConflictError(DEMO_NOT_SAVED, 'demo_read_only')
      return toDomain(await http.post<ProjectDto>(`/projects/${id}/quote-request`))
    },

    save: async (id) => {
      const dto = await editableDto(id)
      if (dto.isDemo === true) throw new ConflictError(DEMO_NOT_SAVED, 'demo_read_only')
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
