import type { ProjectId, SimulationJob, SimulationRequest } from '@/domain'
import type { ProjectService } from './projects'

/** Запуск или пересчёт модели — до 60 секунд (ТЗ 4.3.3): дольше прогон не ждём. */
export const SIMULATION_TIME_LIMIT_S = 60
/** Опрос задания раз в секунду: журнал и секунды на экране обновляются не реже. */
export const SIMULATION_POLL_MS = 1_000

/** Почему прогон не выполнен: ошибка задания или запроса, превышен лимит 60 с, готовый прогон не записался в черновик. */
export type SimulationRunFailure = 'failed' | 'timeout' | 'save'

/** Событие прогресса прогона (этап 3): журнал строками и секунды с начала. */
export type SimulationRunProgress =
  | { readonly status: 'running'; readonly log: readonly string[]; readonly elapsedS: number }
  | { readonly status: 'done'; readonly log: readonly string[]; readonly elapsedS: number; readonly runId: string }
  | {
    readonly status: 'error'
    readonly log: readonly string[]
    readonly elapsedS: number
    readonly reason: SimulationRunFailure
    /** Текст ошибки задания от сервиса симуляции; null — показать общий. */
    readonly message: string | null
  }

export type SimulationRunListener = (progress: SimulationRunProgress | null) => void

/**
 * Прогоны симуляции по проектам (PRD 11.4, этап 3; D-103). Живёт в ServicesProvider, а не на странице:
 * уход со страницы и возврат прогон не теряют. Один прогон на проект — новый запуск заменяет прежний.
 */
export interface SimulationRunService {
  /** Поставить прогон в очередь и следить за ним. persist — записать готовый прогон в черновик (у гостя — нет, D-14). */
  start(projectId: ProjectId, request: SimulationRequest, options: { readonly persist: boolean }): void
  /** Перестать следить: отмены задания в API нет (api-contract.md, №14) — прогон не записывается. */
  stop(projectId: ProjectId): void
  get(projectId: ProjectId): SimulationRunProgress | null
  /** Подписка на события прогресса проекта; null — прогон остановлен. Возвращает отписку. */
  subscribe(projectId: ProjectId, listener: SimulationRunListener): () => void
}

interface RunnerOptions {
  readonly pollMs: number
  readonly limitS: number
  readonly now: () => number
}

interface Tracked {
  readonly token: number
  readonly progress: SimulationRunProgress
}

const DEFAULT_OPTIONS: RunnerOptions = { pollMs: SIMULATION_POLL_MS, limitS: SIMULATION_TIME_LIMIT_S, now: () => Date.now() }

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms) })

export function createSimulationRuns(projects: ProjectService, overrides: Partial<RunnerOptions> = {}): SimulationRunService {
  const { pollMs, limitS, now } = { ...DEFAULT_OPTIONS, ...overrides }
  let runs: ReadonlyMap<ProjectId, Tracked> = new Map()
  let listeners: ReadonlyMap<ProjectId, ReadonlySet<SimulationRunListener>> = new Map()
  let lastToken = 0

  const notify = (projectId: ProjectId, progress: SimulationRunProgress | null) => {
    listeners.get(projectId)?.forEach((listener) => { listener(progress) })
  }
  const isCurrent = (projectId: ProjectId, token: number): boolean => runs.get(projectId)?.token === token
  /** Событие устаревшего запуска (остановлен или заменён) не публикуется. */
  const publish = (projectId: ProjectId, token: number, progress: SimulationRunProgress) => {
    if (!isCurrent(projectId, token)) return
    runs = new Map([...runs, [projectId, { token, progress }]])
    notify(projectId, progress)
  }

  const finish = async (projectId: ProjectId, token: number, job: SimulationJob, runId: string, persist: boolean) => {
    const base = { log: job.log, elapsedS: job.elapsedS }
    if (persist) {
      try {
        await projects.updateInputs(projectId, { simulation: { runId, stage: 'verdict' } })
      } catch (error: unknown) {
        console.error('Прогон готов, но не записался в черновик', error)
        publish(projectId, token, { status: 'error', ...base, reason: 'save', message: null })
        return
      }
    }
    publish(projectId, token, { status: 'done', ...base, runId })
  }

  const follow = async (projectId: ProjectId, token: number, request: SimulationRequest, persist: boolean) => {
    const startedAt = now()
    const fail = (reason: SimulationRunFailure, job: SimulationJob | null, message: string | null) => {
      publish(projectId, token, { status: 'error', log: job?.log ?? [], elapsedS: job?.elapsedS ?? 0, reason, message })
    }
    let job: SimulationJob
    try {
      job = await projects.startSimulation(projectId, request)
    } catch (error: unknown) {
      console.error('Не удалось поставить прогон в очередь', error)
      fail('failed', null, null)
      return
    }
    for (;;) {
      if (!isCurrent(projectId, token)) return
      if (job.status === 'done' && job.runId) {
        await finish(projectId, token, job, job.runId, persist)
        return
      }
      if (job.status === 'error' || job.status === 'done') {
        fail('failed', job, job.error)
        return
      }
      const elapsedS = Math.max(job.elapsedS, Math.floor((now() - startedAt) / 1_000))
      if (elapsedS >= limitS) {
        fail('timeout', job, null)
        return
      }
      publish(projectId, token, { status: 'running', log: job.log, elapsedS: job.elapsedS })
      await wait(pollMs)
      if (!isCurrent(projectId, token)) return
      try {
        job = await projects.getSimulationJob(job.id)
      } catch (error: unknown) {
        console.error('Не удалось получить ход прогона', error)
        fail('failed', job, null)
        return
      }
    }
  }

  return {
    start: (projectId, request, { persist }) => {
      lastToken += 1
      const token = lastToken
      runs = new Map([...runs, [projectId, { token, progress: { status: 'running', log: [], elapsedS: 0 } }]])
      notify(projectId, runs.get(projectId)?.progress ?? null)
      void follow(projectId, token, request, persist)
    },
    stop: (projectId) => {
      runs = new Map([...runs].filter(([id]) => id !== projectId))
      notify(projectId, null)
    },
    get: (projectId) => runs.get(projectId)?.progress ?? null,
    subscribe: (projectId, listener) => {
      listeners = new Map([...listeners, [projectId, new Set([...(listeners.get(projectId) ?? []), listener])]])
      return () => {
        const rest = [...(listeners.get(projectId) ?? [])].filter((l) => l !== listener)
        listeners = new Map([...listeners, [projectId, new Set(rest)]])
      }
    },
  }
}
