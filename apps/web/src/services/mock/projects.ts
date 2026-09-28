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
  type DraftProject,
  type Project,
  type ProjectId,
  type SavedProject,
} from '@/domain'
import { CONDITIONS_LP01_RAAS, OPERATIONS_PER_DAY_LP01, SENSITIVITY_LP01_RAAS } from '@/mocks/fixtures/projectEconomics'
import { EVALUATIONS_BY_PROCESS } from '@/mocks/fixtures/projectMatching'
import { DEMO_PROJECT_DTO, PROJECT_DTOS, PROJECT_LOCAL_STATE } from '@/mocks/fixtures/projects'
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
 * Записанные 2D-трассы (scripts/gen2dTraces.py — настоящий движок simcore): грузятся по запросу, в основной бандл
 * не попадают. Есть у прогонов 01 (состав не менялся — одна трасса) и 02 (18/6 → 16/5); у остальных — пусто.
 */
const TRACE_FILES = {
  'demo-18-6': () => import('@/mocks/fixtures/traces/demo-18-6.json'),
  'demo-16-5': () => import('@/mocks/fixtures/traces/demo-16-5.json'),
} as const
export type TraceFile = keyof typeof TRACE_FILES
/** Ответ сервиса трасс по файлу; тесты подставляют маленькие трассы вместо файлов по 1,7 МБ. */
export type TraceLoader = (file: TraceFile) => Promise<unknown>
const loadTraceFile: TraceLoader = (file) => TRACE_FILES[file]().then((module) => module.default)
const TRACES_BY_RUN: Readonly<Record<string, readonly TraceFile[]>> = {
  'SIM-0926-01': ['demo-18-6'],
  'SIM-0926-02': ['demo-18-6', 'demo-16-5'],
  'SIM-0926-03': [],
  'SIM-0926-04': [],
  'SIM-0926-05': [],
}

/** Журнал прогона строками (этап 3): мок продвигает его на строку за опрос. */
const RUN_LOG = [
  'Смоделированы сутки: 2 000 операций, пик 130 рейсов/ч',
  'Маршруты и зарядка: роботы, станции, доступность 0,92',
  'Проверяем запас в пиковые часы',
  'Сводный вердикт по худшему дню',
]

/** Id проекта — следующий за наибольшим: PJ-08 после семи демо-проектов. */
function nextId(ids: readonly string[]): ProjectId {
  const last = Math.max(0, ...ids.map((id) => Number(id.slice('PJ-'.length)) || 0))
  return `PJ-${String(last + 1).padStart(2, '0')}`
}

const now = (): string => new Date().toISOString()

type RunDto = SimulationSchemas['SimulationRun']

/** Прогоны симуляции грузятся при первом обращении: в основной бандл кабинета они не входят. */
let runsLoading: Promise<readonly RunDto[]> | null = null
const loadRuns = (): Promise<readonly RunDto[]> => {
  runsLoading ??= import('@/mocks/fixtures/simulationRuns.generated').then((module) => module.SIMULATION_RUNS)
  return runsLoading
}

/** Прогон, который мок «насчитает» для состава: у кого проверенный состав совпал, иначе — основной (confirmed). */
function runForFleet(runs: readonly RunDto[], robots: number, stations: number): RunDto {
  const match = runs.find((r) => r.fleet_change.from_.robots === robots && r.fleet_change.from_.chargers === stations)
  const fallback = runs.find((r) => r.simulation_id === DEFAULT_RUN_ID)
  const run = match ?? fallback
  if (!run) throw new Error(`Фикстура прогона ${DEFAULT_RUN_ID} не найдена`)
  return run
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
  let jobs: ReadonlyMap<string, { readonly projectId: ProjectId; readonly runId: string; readonly polls: number }> = new Map()

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
        versions: { catalog: 4, model: '2.1', norms: 3, dictionaries: 1 },
        ...(locationProcessId ? { task: { id: locationProcessId } } : {}),
        ...(solutionId ? { pinnedSolutionId: solutionId } : {}),
      }
      put(id, { dto, local: { step: 'params', inputs: emptyInputs(at), result: null } })
      return toDomain(find(id)) as DraftProject
    }),

    updateInputs: (id, patch) => attempt(() => {
      const stored = editable(id)
      const at = now()
      put(id, { dto: { ...stored.dto, updatedAt: at }, local: { ...stored.local, inputs: applyInputsPatch(stored.local.inputs, patch, at) } })
      return toDomain(find(id))
    }),

    openStep: (id, step) => attempt(() => {
      const stored = find(id)
      const project = toDomain(stored)
      if (!canOpenStep(project, step)) throw new ConflictError('Этот шаг откроется, когда будут пройдены предыдущие')
      if (project.status === 'draft') put(id, { ...stored, local: { ...stored.local, step: furthestStep(project.step, step) } })
      return toDomain(find(id))
    }),

    getMatching: (id) => attempt(() => {
      const stored = find(id)
      return { ...toMatchingEvaluation(evaluationOf(stored)), stale: stored.local.inputs.stale.matching }
    }),

    startSimulation: async (id) => {
      const stored = editable(id)
      const runs = await loadRuns()
      const fleet = stored.local.inputs.simulation?.fleet
      const run = fleet ? runForFleet(runs, fleet.robots, fleet.stations) : runForFleet(runs, -1, -1)
      const jobId = `JOB-${String(jobs.size + 1)}`
      jobs = new Map([...jobs, [jobId, { projectId: id, runId: run.simulation_id, polls: 0 }]])
      return respond(toSimulationJob({ job_id: jobId, status: 'queued', log: [], elapsed: 0 }), options)
    },

    getSimulationJob: (jobId) => attempt(() => {
      const job = jobs.get(jobId)
      if (!job) throw new NotFoundError(`Задание ${jobId} не найдено`)
      const polls = job.polls + 1
      jobs = new Map([...jobs, [jobId, { ...job, polls }]])
      const done = polls > RUN_LOG.length
      if (done) {
        const stored = find(job.projectId)
        const at = now()
        const inputs = applyInputsPatch(stored.local.inputs, { simulation: { runId: job.runId } }, at)
        put(job.projectId, { ...stored, local: { ...stored.local, inputs: markFresh(inputs, 'simulation', at) } })
      }
      return toSimulationJob({
        job_id: jobId,
        status: done ? 'done' : 'running',
        log: RUN_LOG.slice(0, Math.min(polls, RUN_LOG.length)),
        elapsed: polls * 3,
        ...(done ? { simulation_ids: [job.runId] } : {}),
      })
    }),

    getSimulationRun: async (runId) => {
      const run = (await loadRuns()).find((r) => r.simulation_id === runId)
      if (!run) throw new NotFoundError(`Прогон ${runId} не найден`)
      return respond(toSimulationRun(run), options)
    },

    getSimulationTraces: async (runId) => {
      const files = TRACES_BY_RUN[runId]
      if (!files) throw new NotFoundError(`Прогон ${runId} не найден`)
      const dtos = await Promise.all(files.map(loadTrace))
      return respond(dtos.map(toSimulationTrace), options)
    },

    getEconomics: (id) => attempt(() => {
      const stored = find(id)
      const selection = stored.local.inputs.matching?.selection
      if (!selection) throw new NotFoundError('Итог появится, когда на подборе выбран вариант')
      return toEconomics(evaluationOf(stored), selection.solutionId, {
        sensitivity: SENSITIVITY_LP01_RAAS,
        conditions: CONDITIONS_LP01_RAAS,
        operationsPerDay: OPERATIONS_PER_DAY_LP01,
      })
    }),

    save: (id) => attempt(() => {
      const stored = editable(id)
      const { inputs } = stored.local
      const selection = inputs.matching?.selection
      if (!selection) throw new ConflictError('Сохранить можно, когда на подборе выбран вариант')
      const scenarioModel = inputs.economics?.scenario ?? selection.acquisition
      const economics = toEconomics(evaluationOf(stored), selection.solutionId, { sensitivity: [], conditions: [], operationsPerDay: OPERATIONS_PER_DAY_LP01 })
      const scenario = economics.scenarios.find((s) => s.acquisition === scenarioModel)
      if (!scenario || scenario.paybackYears === null) throw new ConflictError('У выбранного сценария нет окупаемости — сохранить нельзя')
      const at = now()
      put(id, {
        dto: { ...stored.dto, status: 'saved', savedAt: at, updatedAt: at, task: stored.dto.task ?? {} },
        local: {
          ...stored.local,
          step: 'economics',
          result: { capexRub: scenario.capexRub, opexRubPerYear: scenario.opexRubPerYear, paybackYears: scenario.paybackYears, annualEffectRub: scenario.annualEffectRub },
        },
      })
      return toDomain(find(id)) as SavedProject
    }),
  }
}
