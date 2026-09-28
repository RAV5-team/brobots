import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Fleet,
  MatchingEvaluation,
  Project,
  ProjectParamsSnapshot,
  Robot,
  RobotId,
  SimulationConditions,
  SimulationInputs,
  SimulationRequest,
  SimulationStage,
} from '@/domain'
import type { SimulationRunProgress } from '@/services'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'
import { furthestStage } from './simulationModel'

const t = ru.project.simulation

export interface SimulationData {
  readonly evaluation: MatchingEvaluation
  readonly snapshot: ProjectParamsSnapshot
  /** Робот выбранного варианта — способ обработки для коэффициента замещения (этап 2); null — не загрузился. */
  readonly robot: Robot | null
}

export type SimulationLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly data: SimulationData }

export interface SimulationStepState {
  readonly load: SimulationLoad
  readonly retry: () => void
  readonly project: Project
  /** Решения шага на странице: у гостя живут только здесь (D-14). */
  readonly inputs: SimulationInputs | null
  readonly savedAt: string | null
  readonly saveError: string | null
  /** Прогон есть, но состав или условия с тех пор изменились (D-89). */
  readonly stale: boolean
  /** Состав для проверки; null — как в подборе. */
  readonly setFleet: (fleet: Fleet | null) => void
  /** Условия этапа 2; пустой объект — всё из задачи и по умолчанию. */
  readonly setConditions: (conditions: Partial<SimulationConditions>) => void
  /** Открыт этап: черновик запоминает самый дальний. */
  readonly reachStage: (stage: SimulationStage) => void
  /** Прогон проекта в SimulationRunService: переживает уход со страницы (D-103). */
  readonly run: SimulationRunProgress | null
  readonly startRun: (request: SimulationRequest) => void
  readonly stopRun: () => void
  /** План вердикта и принятый риск (этап 4): ничего не делают устаревшим (D-89). */
  readonly setVerdict: (patch: Pick<SimulationInputs, 'plan' | 'acceptRisk'>) => void
  /** Дождаться записи плана перед переходом к экономике; у гостя и сохранённой оценки — сразу. */
  readonly commitVerdict: () => Promise<void>
}

const EMPTY: SimulationInputs = { stage: 'scope', fleet: null, conditions: {}, runId: null, plan: null, acceptRisk: false }

/** Готовый прогон в решениях шага: этап 4 открыт (D-103). */
function withRun(inputs: SimulationInputs | null, runId: string): SimulationInputs {
  const base = inputs ?? EMPTY
  return { ...base, runId, stage: furthestStage(base.stage, 'verdict') }
}

/** Вернулись на страницу, а прогон за это время закончился: у гостя его ещё нет в решениях проекта (D-14). */
function finishedRunId(progress: SimulationRunProgress | null, inputs: SimulationInputs | null): string | null {
  return progress?.status === 'done' && progress.runId !== inputs?.runId ? progress.runId : null
}

/**
 * Данные и решения шага 3 (PRD 11.4): расчёт подбора (выбранный вариант, цикл, производительность) и снимок шага 1
 * (потребность в пик). Черновик сохраняет каждое решение сразу (D-21), гость — только на странице (D-14),
 * сохранённая оценка — только просмотр (D-17).
 */
export function useSimulationStep(initial: Project, canSave: boolean): SimulationStepState {
  const services = useServices()
  const [load, setLoad] = useState<SimulationLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [project, setProject] = useState(initial)
  const runs = services.simulationRuns
  const [run, setRun] = useState<SimulationRunProgress | null>(() => runs.get(initial.id))
  const [inputs, setInputs] = useState<SimulationInputs | null>(() => {
    const runId = finishedRunId(runs.get(initial.id), initial.inputs.simulation)
    return runId === null ? initial.inputs.simulation : withRun(initial.inputs.simulation, runId)
  })
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stale, setStale] = useState(() => initial.inputs.stale.simulation && finishedRunId(runs.get(initial.id), initial.inputs.simulation) === null)
  const lastRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    const solutionId = initial.inputs.matching?.selection?.solutionId ?? null
    // Без робота этап 2 возьмёт коэффициент замещения первого способа процесса — загрузку шага это не останавливает.
    const robot = solutionId === null
      ? Promise.resolve(null)
      : services.catalog.getRobot(solutionId as RobotId).catch((error: unknown) => {
        console.error('Не удалось загрузить робота выбранного варианта', error)
        return null
      })
    Promise.all([services.projects.getMatching(initial.id), services.projects.getParamsSnapshot(initial.id), robot])
      .then(([evaluation, snapshot, selectedRobot]) => {
        if (!cancelled) setLoad({ status: 'ready', data: { evaluation, snapshot, robot: selectedRobot } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить данные симуляции', error)
        setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, initial.id, initial.inputs.matching?.selection?.solutionId, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const persist = useCallback((patch: Partial<SimulationInputs>) => {
    if (!canSave) return
    const id = lastRequest.current + 1
    lastRequest.current = id
    services.projects.updateInputs(initial.id, { simulation: patch })
      .then((saved) => {
        if (lastRequest.current !== id) return
        setProject(saved)
        setStale(saved.inputs.stale.simulation)
        setSavedAt(saved.updatedAt)
        setSaveError(null)
      })
      .catch((error: unknown) => {
        console.error('Не удалось сохранить шаг «Симуляция»', error)
        if (lastRequest.current === id) setSaveError(t.save.failed)
      })
  }, [canSave, services, initial.id])

  /** Правило D-89 и у гостя: правка состава или условий после прогона делает прогон устаревшим. */
  const markStale = useCallback((changed: boolean) => {
    if (changed && inputs?.runId != null) setStale(true)
  }, [inputs?.runId])

  const setFleet = useCallback((fleet: Fleet | null) => {
    markStale(JSON.stringify(fleet) !== JSON.stringify(inputs?.fleet ?? null))
    setInputs((current) => ({ ...(current ?? EMPTY), fleet }))
    persist({ fleet })
  }, [inputs?.fleet, markStale, persist])

  const setConditions = useCallback((conditions: Partial<SimulationConditions>) => {
    markStale(JSON.stringify(conditions) !== JSON.stringify(inputs?.conditions ?? {}))
    setInputs((current) => ({ ...(current ?? EMPTY), conditions }))
    persist({ conditions })
  }, [inputs?.conditions, markStale, persist])

  const reachStage = useCallback((stage: SimulationStage) => {
    const next = furthestStage(inputs?.stage ?? 'scope', stage)
    if (next === inputs?.stage) return
    setInputs((current) => ({ ...(current ?? EMPTY), stage: next }))
    persist({ stage: next })
  }, [inputs?.stage, persist])

  /** Готовый прогон — в решения страницы: у гостя он живёт только здесь, черновик записал SimulationRunService. */
  const applyRun = useCallback((runId: string) => {
    setInputs((current) => withRun(current, runId))
    setStale(false)
    if (!canSave) return
    services.projects.getProject(initial.id)
      .then((saved) => {
        setProject(saved)
        setSavedAt(saved.updatedAt)
      })
      .catch((error: unknown) => { console.error('Не удалось обновить проект после прогона', error) })
  }, [canSave, services, initial.id])

  useEffect(() => runs.subscribe(initial.id, (progress) => {
    setRun(progress)
    if (progress?.status === 'done') applyRun(progress.runId)
  }), [runs, initial.id, applyRun])

  const startRun = useCallback((request: SimulationRequest) => {
    runs.start(initial.id, request, { persist: canSave })
  }, [runs, initial.id, canSave])

  const stopRun = useCallback(() => { runs.stop(initial.id) }, [runs, initial.id])

  const setVerdict = useCallback((patch: Pick<SimulationInputs, 'plan' | 'acceptRisk'>) => {
    setInputs((current) => ({ ...(current ?? EMPTY), ...patch }))
    persist(patch)
  }, [persist])

  const commitVerdict = useCallback(async () => {
    if (!canSave) return
    lastRequest.current += 1
    const saved = await services.projects.updateInputs(initial.id, {
      simulation: { plan: inputs?.plan ?? null, acceptRisk: inputs?.acceptRisk ?? false },
    })
    setProject(saved)
    setSavedAt(saved.updatedAt)
    setSaveError(null)
  }, [canSave, services, initial.id, inputs?.plan, inputs?.acceptRisk])

  return { load, retry, project, inputs, savedAt, saveError, stale, setFleet, setConditions, reachStage, run, startRun, stopRun, setVerdict, commitVerdict }
}
