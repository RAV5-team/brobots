import type { ApiSchemas, SimulationSchemas } from '@/api/contract'
import { toEconomics } from '@/api/mappers/economics'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { toProject, type ProjectLocalState } from '@/api/mappers/project'
import { toSimulationJob, toSimulationRun } from '@/api/mappers/simulation'
import { toSimulationTrace } from '@/api/mappers/trace'
import {
  applyInputsPatch,
  canOpenStep,
  emptyInputs,
  furthestStep,
  markFresh,
  modelNormsFrom,
  type DraftProject,
  type Fleet,
  type MatchingEvaluation,
  type Project,
  type ParamsProcessEntry,
  type ProjectId,
  type ProjectParamsSnapshot,
  type SavedProject,
  type TraceResolution,
} from '@/domain'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { NORMS } from '@/mocks/fixtures/norms'
import { HANDLING_METHODS, OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { SITE_PARAMETERS, SITE_VALUES } from '@/mocks/fixtures/siteParameters'
import { CONDITIONS_LP01, OPERATIONS_PER_DAY_LP01 } from '@/mocks/fixtures/projectEconomics'
import { CALC_DEFAULTS_BY_PROCESS, EVALUATIONS_BY_PROCESS } from '@/mocks/fixtures/projectMatching'
import { DEMO_PROJECT_DTO, PROJECT_DTOS, PROJECT_LOCAL_STATE, PROJECT_VERSIONS } from '@/mocks/fixtures/projects'
import demo165Url from '@/mocks/fixtures/traces/demo-16-5.json?url'
import demo186Url from '@/mocks/fixtures/traces/demo-18-6.json?url'
import { formatNumber } from '@/shared/format'
import { ConflictError, NotFoundError } from '../errors'
import type { ProjectService } from '../projects'
import { respond, type MockOptions } from './respond'

type ProjectDto = ApiSchemas['Project']
interface StoredProject {
  readonly dto: ProjectDto
  readonly local: ProjectLocalState
}

const READ_ONLY = 'Сохранённая оценка открывается только для просмотра — измените её в новом проекте на её основе'
const DEFAULT_RUN_ID = 'SIM-0926-01'

/**
 * Записанные 2D-трассы (scripts/gen2dTraces.py — настоящий движок simcore): в основной бандл не попадают.
 * Полная запись (1,6–1,8 МБ) — отдельным файлом через fetch: разбор JSON дешевле, чем JS-модуля того же размера.
 * Почасовой срез (scripts/genHourlyTraces.ts, около 50 КБ) — для кадра отчёта 09, которому нужна одна минута.
 * Есть у прогонов 01 (состав не менялся — одна трасса) и 02 (18/6 → 16/5); у остальных — пусто.
 */
const TRACE_URLS = { 'demo-18-6': demo186Url, 'demo-16-5': demo165Url } as const
const HOURLY_TRACES = {
  'demo-18-6': () => import('@/mocks/fixtures/traces/demo-18-6.hourly.json'),
  'demo-16-5': () => import('@/mocks/fixtures/traces/demo-16-5.hourly.json'),
} as const
export type TraceFile = keyof typeof TRACE_URLS
/** Ответ сервиса трасс по файлу; тесты подставляют маленькие трассы вместо настоящих файлов. */
export type TraceLoader = (file: TraceFile, resolution: TraceResolution) => Promise<unknown>

async function fetchTrace(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Трасса ${url}: HTTP ${String(response.status)}`)
  return response.json()
}

const loadTraceFile: TraceLoader = (file, resolution) =>
  resolution === 'hourly' ? HOURLY_TRACES[file]().then((module) => module.default) : fetchTrace(TRACE_URLS[file])
const TRACES_BY_RUN: Readonly<Record<string, readonly TraceFile[]>> = {
  'SIM-0926-01': ['demo-18-6'],
  'SIM-0926-02': ['demo-18-6', 'demo-16-5'],
  'SIM-0926-03': [],
  'SIM-0926-04': [],
  'SIM-0926-05': [],
}

/**
 * Журнал прогона строками (этап 3) в духе сообщений simcore/verify: мок продвигает его на строку за опрос
 * и считает секунду за опрос — экран опрашивает раз в секунду, число секунд не зависит от машины.
 */
function runLog(run: RunDto, fleet: Fleet): readonly string[] {
  const peak = run.checks_before.throughput.required_h
  return [
    `Смоделированы сутки: пик ${formatNumber(peak)} рейсов/ч`,
    `Маршруты и зарядка: роботов ${formatNumber(fleet.robots)}, станций ${formatNumber(fleet.stations)}`,
    ...run.verdict.justification.slice(0, 1).map((line) => `Проверяем запас: ${line.charAt(0).toLowerCase()}${line.slice(1)}`),
    `Сводный вердикт по худшему дню: ${run.verdict.title}`,
  ]
}

/** Id проекта — следующий за наибольшим: PJ-08 после семи демо-проектов. */
function nextId(ids: readonly string[]): ProjectId {
  const last = Math.max(0, ...ids.map((id) => Number(id.slice('PJ-'.length)) || 0))
  return `PJ-${String(last + 1).padStart(2, '0')}`
}

const now = (): string => new Date().toISOString()

/** Статус после создания черновика и сохранения оценки известен заранее — проверяем его, а не приводим тип. */
function asDraft(project: Project): DraftProject {
  if (project.status !== 'draft') throw new Error(`Проект ${project.id}: ожидался черновик, статус «${project.status}»`)
  return project
}

function asSaved(project: Project): SavedProject {
  if (project.status !== 'saved') throw new Error(`Проект ${project.id}: ожидалась сохранённая оценка, статус «${project.status}»`)
  return project
}

type RunDto = SimulationSchemas['SimulationRun']

/** Прогоны симуляции грузятся при первом обращении: в основной бандл кабинета они не входят. */
let runsLoading: Promise<readonly RunDto[]> | null = null
const loadRuns = (): Promise<readonly RunDto[]> => {
  runsLoading ??= import('@/mocks/fixtures/simulationRuns.generated').then((module) => module.SIMULATION_RUNS)
  return runsLoading
}

/** Поля окна 2.1а (цена, условия RaaS, оборудование, разбор балла) — тоже при первом обращении. */
let detailsLoading: Promise<typeof import('./variantDetails')> | null = null
const loadVariantDetails = (): Promise<typeof import('./variantDetails')> => {
  detailsLoading ??= import('./variantDetails')
  return detailsLoading
}

/** Прогон, который мок «насчитает» для состава: у кого проверенный состав совпал, иначе — основной (confirmed). */
function runForFleet(runs: readonly RunDto[], robots: number, stations: number): RunDto {
  const match = runs.find((r) => r.fleet_change.from_.robots === robots && r.fleet_change.from_.chargers === stations)
  const fallback = runs.find((r) => r.simulation_id === DEFAULT_RUN_ID)
  const run = match ?? fallback
  if (!run) throw new Error(`Фикстура прогона ${DEFAULT_RUN_ID} не найдена`)
  return run
}

/** Процессы локации с шаблонами и классами операций — в порядке фикстуры (как вкладка «Процессы» локации). */
function processesOf(locationId: string): readonly ParamsProcessEntry[] {
  return LOCATION_PROCESSES.filter((lp) => lp.locationId === locationId).map((locationProcess) => {
    const process = PROCESSES.find((p) => p.code === locationProcess.processCode)
    if (!process) throw new Error(`Фикстура процесса ${locationProcess.processCode} не найдена`)
    return { locationProcess, process, operationClass: OPERATION_CLASSES.find((c) => c.code === process.operationClass) ?? null }
  })
}

/**
 * Снимок шага 1: профиль локации на дату снимка. Мок снимки не хранит — отдаёт профиль из фикстур
 * (изменения профиля в сессии сюда не попадают, как и в настоящий снимок).
 */
function paramsSnapshot(dto: ProjectDto): ProjectParamsSnapshot {
  const location = LOCATIONS.find((l) => l.id === dto.locationId)
  if (!location) throw new NotFoundError(`Локация ${String(dto.locationId)} не найдена`)
  const pinned = dto.status === 'draft' && dto.pinnedSolutionId ? ROBOTS.find((r) => r.id === dto.pinnedSolutionId) : undefined
  return {
    location,
    facilityParameters: FACILITY_PARAMETERS.filter((p) => p.facilityType === location.facilityType),
    siteParameters: SITE_PARAMETERS,
    siteValues: SITE_VALUES[location.id] ?? {},
    processes: processesOf(location.id),
    handlingMethods: HANDLING_METHODS,
    pinnedSolution: pinned ? { id: pinned.id, name: pinned.name } : null,
    widthMarginM: modelNormsFrom(NORMS).widthMarginM,
  }
}

export function createMockProjects(options: MockOptions, loadTrace: TraceLoader = loadTraceFile): ProjectService {
  // Созданные и изменённые проекты живут до перезагрузки страницы: фикстуры не меняются.
  let store: ReadonlyMap<string, StoredProject> = new Map(
    [...PROJECT_DTOS, DEMO_PROJECT_DTO].map((dto) => {
      const local = PROJECT_LOCAL_STATE[dto.id ?? '']
      if (!local) throw new Error(`Фикстура проекта ${String(dto.id)}: нет состояния`)
      return [dto.id ?? '', { dto, local }] as const
    }),
  )
  let jobs: ReadonlyMap<string, { readonly runId: string; readonly log: readonly string[]; readonly polls: number }> = new Map()

  const put = (id: string, next: StoredProject) => { store = new Map([...store, [id, next]]) }
  const find = (id: string): StoredProject => {
    const found = store.get(id)
    if (!found) throw new NotFoundError(`Проект ${id} не найден`)
    return found
  }
  const toDomain = ({ dto, local }: StoredProject): Project => toProject(dto, local)
  const editable = (id: ProjectId): StoredProject => {
    const found = find(id)
    if (found.dto.status === 'saved') throw new ConflictError(READ_ONLY)
    return found
  }
  const evaluationOf = (stored: StoredProject): ApiSchemas['Evaluation'] => {
    const evaluation = EVALUATIONS_BY_PROCESS[stored.dto.task?.id ?? '']
    if (!evaluation) throw new NotFoundError('Подбор для этого проекта ещё не рассчитан')
    return evaluation
  }
  const matchingOf = async (stored: StoredProject): Promise<MatchingEvaluation> => {
    const processId = stored.dto.task?.id ?? ''
    const evaluation: MatchingEvaluation = {
      ...toMatchingEvaluation(evaluationOf(stored), CALC_DEFAULTS_BY_PROCESS[processId] ?? null),
      stale: stored.local.inputs.stale.matching,
    }
    const { withVariantDetails } = await loadVariantDetails()
    return withVariantDetails(evaluation, processId)
  }
  /** Ошибки — отказом промиса, как у настоящего запроса. */
  const attempt = <T>(action: () => T): Promise<T> => {
    try {
      return respond(action(), options)
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  return {
    listProjects: () => attempt(() => [...store.values()]
      .filter((p) => !p.dto.isDemo)
      .map(toDomain)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),

    getProject: (id) => attempt(() => toDomain(find(id))),

    createDraft: ({ name, locationId, locationProcessId, solutionId }) => attempt(() => {
      const id = nextId([...store.keys()])
      const at = now()
      const dto: ProjectDto = {
        id, name, locationId, status: 'draft', updatedAt: at, snapshotTakenAt: at,
        versions: PROJECT_VERSIONS,
        ...(locationProcessId ? { task: { id: locationProcessId } } : {}),
        ...(solutionId ? { pinnedSolutionId: solutionId } : {}),
      }
      put(id, { dto, local: { step: 'params', inputs: emptyInputs(at), result: null } })
      return asDraft(toDomain(find(id)))
    }),

    updateInputs: (id, patch) => attempt(() => {
      const stored = editable(id)
      const at = now()
      put(id, { dto: { ...stored.dto, updatedAt: at }, local: { ...stored.local, inputs: applyInputsPatch(stored.local.inputs, patch, at) } })
      return toDomain(find(id))
    }),

    getParamsSnapshot: (id) => attempt(() => paramsSnapshot(find(id).dto)),

    selectProcess: (id, locationProcessId) => attempt(() => {
      const stored = editable(id)
      if (stored.dto.task?.id === locationProcessId) return toDomain(stored)
      const entry = processesOf(stored.dto.locationId ?? '').find((p) => p.locationProcess.id === locationProcessId)
      if (!entry) throw new NotFoundError(`Процесс ${locationProcessId} не относится к локации проекта`)
      const at = now()
      const name = entry.locationProcess.name ?? entry.process.name
      // Подбор, прогон и итог считались для прежнего процесса — черновик начинается заново с «Параметров» (D-94).
      put(id, { dto: { ...stored.dto, task: { id: locationProcessId, name }, updatedAt: at }, local: { ...stored.local, step: 'params', inputs: emptyInputs(at) } })
      return toDomain(find(id))
    }),

    openStep: (id, step) => attempt(() => {
      const stored = find(id)
      const project = toDomain(stored)
      if (!canOpenStep(project, step)) throw new ConflictError('Этот шаг откроется, когда будут пройдены предыдущие')
      if (project.status === 'draft') put(id, { ...stored, local: { ...stored.local, step: furthestStep(project.step, step) } })
      return toDomain(find(id))
    }),

    getMatching: async (id) => respond(await matchingOf(find(id)), options),

    evaluateMatching: async (id) => {
      const stored = editable(id)
      evaluationOf(stored)
      // Мок не пересчитывает: числа рейтинга из фикстуры, снимается только пометка «устарело» (api-contract.md, №11).
      const at = now()
      put(id, { dto: { ...stored.dto, updatedAt: at }, local: { ...stored.local, inputs: markFresh(stored.local.inputs, 'matching', at) } })
      return respond(await matchingOf(find(id)), options)
    },

    startSimulation: async (id, request) => {
      editable(id)
      const runs = await loadRuns()
      const run = runForFleet(runs, request.fleet.robots, request.fleet.stations)
      const jobId = `JOB-${String(jobs.size + 1)}`
      jobs = new Map([...jobs, [jobId, { runId: run.simulation_id, log: runLog(run, request.fleet), polls: 0 }]])
      return respond(toSimulationJob({ job_id: jobId, status: 'queued', log: [], elapsed: 0 }), options)
    },

    getSimulationJob: (jobId) => attempt(() => {
      const job = jobs.get(jobId)
      if (!job) throw new NotFoundError(`Задание ${jobId} не найдено`)
      const polls = job.polls + 1
      jobs = new Map([...jobs, [jobId, { ...job, polls }]])
      const done = polls > job.log.length
      return toSimulationJob({
        job_id: jobId,
        status: done ? 'done' : 'running',
        log: job.log.slice(0, Math.min(polls, job.log.length)),
        elapsed: polls,
        ...(done ? { simulation_ids: [job.runId] } : {}),
      })
    }),

    getSimulationRun: async (runId) => {
      const run = (await loadRuns()).find((r) => r.simulation_id === runId)
      if (!run) throw new NotFoundError(`Прогон ${runId} не найден`)
      return respond(toSimulationRun(run), options)
    },

    getSimulationTraces: async (runId, resolution = 'full') => {
      const files = TRACES_BY_RUN[runId]
      if (!files) throw new NotFoundError(`Прогон ${runId} не найден`)
      const dtos = await Promise.all(files.map((file) => loadTrace(file, resolution)))
      return respond(dtos.map(toSimulationTrace), options)
    },

    getEconomics: (id) => attempt(() => {
      const stored = find(id)
      const selection = stored.local.inputs.matching?.selection
      if (!selection) throw new NotFoundError('Итог появится, когда на подборе выбран вариант')
      return toEconomics(evaluationOf(stored), selection.solutionId, { conditions: CONDITIONS_LP01, operationsPerDay: OPERATIONS_PER_DAY_LP01 })
    }),

    requestQuote: (id) => attempt(() => {
      // Запрос КП не меняет оценку — доступен и черновику, и сохранённой (D-106).
      const stored = find(id)
      const { inputs } = stored.local
      const selection = inputs.matching?.selection
      if (!selection) throw new ConflictError('Запросить КП можно, когда на подборе выбран вариант')
      const at = now()
      const economics = { scenario: inputs.economics?.scenario ?? selection.acquisition, quoteRequestedAt: at }
      put(id, { ...stored, local: { ...stored.local, inputs: { ...inputs, economics } } })
      return toDomain(find(id))
    }),

    save: (id) => attempt(() => {
      const stored = editable(id)
      const { inputs } = stored.local
      const selection = inputs.matching?.selection
      if (!selection) throw new ConflictError('Сохранить можно, когда на подборе выбран вариант')
      const scenarioModel = inputs.economics?.scenario ?? selection.acquisition
      const economics = toEconomics(evaluationOf(stored), selection.solutionId, { conditions: [], operationsPerDay: OPERATIONS_PER_DAY_LP01 })
      const scenario = economics.scenarios.find((s) => s.acquisition === scenarioModel)
      if (!scenario || scenario.paybackYears === null) throw new ConflictError('У выбранного сценария нет окупаемости — сохранить нельзя')
      const at = now()
      // Сохранённая оценка — проект пользователя: демо-проект уходит в «Готовые оценки» A1 (D-81, D-106).
      const resultId = evaluationOf(stored).candidates?.flatMap((c) => c.results ?? [])
        .find((r) => r.solutionId === selection.solutionId && r.acquisitionModel === scenarioModel)?.id
      const dtoSelection = stored.dto.selection
        ? { ...stored.dto.selection, acquisitionModel: scenarioModel, ...(resultId ? { calcResultId: resultId } : {}) }
        : stored.dto.selection
      put(id, {
        dto: { ...stored.dto, status: 'saved', savedAt: at, updatedAt: at, task: stored.dto.task ?? {}, isDemo: false, ...(dtoSelection ? { selection: dtoSelection } : {}) },
        local: {
          ...stored.local,
          step: 'economics',
          result: { capexRub: scenario.capexRub, opexRubPerYear: scenario.opexRubPerYear, paybackYears: scenario.paybackYears, annualEffectRub: scenario.annualEffectRub },
        },
      })
      return asSaved(toDomain(find(id)))
    }),
  }
}
