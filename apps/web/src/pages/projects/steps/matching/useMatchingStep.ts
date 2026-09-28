import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CalcParams,
  MatchingEvaluation,
  MatchingInputs,
  Project,
  ProjectParamsSnapshot,
  ProjectSelection,
  Robot,
} from '@/domain'
import { NotFoundError } from '@/services/errors'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.matching

export interface MatchingData {
  readonly evaluation: MatchingEvaluation
  readonly snapshot: ProjectParamsSnapshot
  /** Роботы каталога по id: подпись «производитель · тип · до N кг» и техника в сравнении. */
  readonly robots: ReadonlyMap<string, Robot>
}

export type MatchingLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notCalculated' }
  | { readonly status: 'ready'; readonly data: MatchingData }

const EMPTY: MatchingInputs = { calcParams: {}, selection: null, manualSolutionIds: [] }

export interface MatchingStepState {
  readonly load: MatchingLoad
  readonly retry: () => void
  readonly project: Project
  readonly draft: MatchingInputs
  /** Подбор посчитан по прежним параметрам (D-89). */
  readonly stale: boolean
  readonly recalculating: boolean
  readonly recalcError: boolean
  readonly savedAt: string | null
  readonly saveError: string | null
  readonly select: (selection: ProjectSelection) => void
  readonly setCalcParams: (next: Partial<CalcParams>) => void
  readonly addManual: (solutionId: string) => void
  readonly removeManual: (solutionId: string) => void
  readonly recalculate: () => void
}

/**
 * Данные и решения шага 2 (PRD 11.3): расчёт подбора, снимок площадки (проверки «требует проверки»), каталог.
 * Пользователь в черновике — каждое решение сразу уходит в сервис (D-21); гость проходит путь без сохранения (D-14),
 * сохранённая оценка — только просмотр (D-17). Правка «Параметров расчёта» делает подбор устаревшим до пересчёта (D-89).
 */
export function useMatchingStep(initial: Project, canSave: boolean): MatchingStepState {
  const services = useServices()
  const [load, setLoad] = useState<MatchingLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [project, setProject] = useState(initial)
  const [draft, setDraft] = useState<MatchingInputs>(initial.inputs.matching ?? EMPTY)
  const [stale, setStale] = useState(initial.inputs.stale.matching)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcError, setRecalcError] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const lastRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.projects.getMatching(initial.id),
      services.projects.getParamsSnapshot(initial.id),
      services.catalog.listRobots(),
    ])
      .then(([evaluation, snapshot, robots]) => {
        if (cancelled) return
        setLoad({ status: 'ready', data: { evaluation, snapshot, robots: new Map(robots.map((r) => [r.id, r])) } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setLoad({ status: 'notCalculated' })
          return
        }
        console.error('Не удалось загрузить подбор', error)
        setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, initial.id, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const persist = useCallback((patch: Partial<MatchingInputs>) => {
    if (!canSave) return
    const id = lastRequest.current + 1
    lastRequest.current = id
    services.projects.updateInputs(initial.id, { matching: patch })
      .then((saved) => {
        if (lastRequest.current !== id) return
        setProject(saved)
        setStale(saved.inputs.stale.matching)
        setSavedAt(saved.updatedAt)
        setSaveError(null)
      })
      .catch((error: unknown) => {
        console.error('Не удалось сохранить шаг «Подбор»', error)
        if (lastRequest.current === id) setSaveError(t.rail.save.failed)
      })
  }, [canSave, services, initial.id])

  const update = useCallback((patch: Partial<MatchingInputs>) => {
    setDraft((current) => ({ ...current, ...patch }))
    persist(patch)
  }, [persist])

  const select = useCallback((selection: ProjectSelection) => { update({ selection }) }, [update])

  const setCalcParams = useCallback((next: Partial<CalcParams>) => {
    // Правило D-89 и у гостя: иначе он не увидит, что рейтинг посчитан по прежним значениям.
    if (JSON.stringify(next) !== JSON.stringify(draft.calcParams)) setStale(true)
    update({ calcParams: next })
  }, [draft.calcParams, update])

  const addManual = useCallback((solutionId: string) => {
    if (draft.manualSolutionIds.includes(solutionId)) return
    update({ manualSolutionIds: [...draft.manualSolutionIds, solutionId] })
  }, [draft.manualSolutionIds, update])

  const removeManual = useCallback((solutionId: string) => {
    update({ manualSolutionIds: draft.manualSolutionIds.filter((id) => id !== solutionId) })
  }, [draft.manualSolutionIds, update])

  const recalculate = useCallback(() => {
    setRecalcError(false)
    if (!canSave) {
      // Гость и мок: пересчёта на странице нет — числа из демо-расчёта, снимается только пометка.
      setStale(false)
      return
    }
    setRecalculating(true)
    services.projects.evaluateMatching(initial.id)
      .then(async (evaluation) => {
        const [fresh, snapshot, robots] = await Promise.all([
          services.projects.getProject(initial.id),
          services.projects.getParamsSnapshot(initial.id),
          services.catalog.listRobots(),
        ])
        setProject(fresh)
        setStale(evaluation.stale)
        setLoad({ status: 'ready', data: { evaluation, snapshot, robots: new Map(robots.map((r) => [r.id, r])) } })
      })
      .catch((error: unknown) => {
        console.error('Не удалось пересчитать подбор', error)
        setRecalcError(true)
      })
      .finally(() => { setRecalculating(false) })
  }, [canSave, services, initial.id])

  return { load, retry, project, draft, stale, recalculating, recalcError, savedAt, saveError, select, setCalcParams, addManual, removeManual, recalculate }
}
