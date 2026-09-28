import { useCallback, useEffect, useState } from 'react'
import type {
  AcquisitionModel,
  EconomicsResult,
  MatchingEvaluation,
  Project,
  ProjectParamsSnapshot,
  SimulationRun,
} from '@/domain'
import { NotFoundError } from '@/services/errors'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'
import { selectedAcquisition } from './economicsView'

const t = ru.project.economics

export interface EconomicsData {
  readonly economics: EconomicsResult
  readonly matching: MatchingEvaluation
  readonly snapshot: ProjectParamsSnapshot
  /** Прогон симуляции проекта; null — не запускали или не загрузился (итог показывается по расчёту подбора). */
  readonly run: SimulationRun | null
}

export type EconomicsLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'noSelection' }
  | { readonly status: 'ready'; readonly data: EconomicsData }

type Pending = 'save' | 'quote' | null

export interface EconomicsStepState {
  readonly load: EconomicsLoad
  readonly retry: () => void
  readonly project: Project
  /** Выбранный сценарий: уйдёт в снимок оценки и отчёт (PRD 11.5). */
  readonly selected: AcquisitionModel
  readonly pending: Pending
  readonly error: string | null
  readonly choose: (scenario: AcquisitionModel) => void
  /** Сохранить оценку (D-81); вернёт сохранённый проект или null при ошибке. */
  readonly save: () => Promise<Project | null>
  readonly requestQuote: () => Promise<boolean>
}

/**
 * Данные и решения шага 4 (PRD 11.5, 11.6): итог выбранного решения, подбор (место в рейтинге, счётчики),
 * снимок шага 1 (исполнители, объём) и прогон. Выбор сценария у черновика сразу уходит в сервис (D-21), у гостя —
 * только на странице (D-14), у сохранённой оценки не меняется (D-17). КП — и у черновика, и у сохранённой (D-106).
 */
export function useEconomicsStep(initial: Project, canSave: boolean): EconomicsStepState {
  const services = useServices()
  const [load, setLoad] = useState<EconomicsLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [project, setProject] = useState(initial)
  const [selected, setSelected] = useState<AcquisitionModel>(selectedAcquisition(initial))
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const runId = initial.inputs.simulation?.runId ?? null
    const run = runId
      ? services.projects.getSimulationRun(runId).catch((reason: unknown) => {
        console.error('Не удалось загрузить прогон для итога', reason)
        return null
      })
      : Promise.resolve(null)
    Promise.all([
      services.projects.getEconomics(initial.id),
      services.projects.getMatching(initial.id),
      services.projects.getParamsSnapshot(initial.id),
      run,
    ])
      .then(([economics, matching, snapshot, simulationRun]) => {
        if (!cancelled) setLoad({ status: 'ready', data: { economics, matching, snapshot, run: simulationRun } })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        if (reason instanceof NotFoundError) {
          setLoad({ status: 'noSelection' })
          return
        }
        console.error('Не удалось загрузить итог и экономику', reason)
        setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, initial.id, initial.inputs.simulation?.runId, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const choose = useCallback((scenario: AcquisitionModel) => {
    if (project.status === 'saved') return
    setSelected(scenario)
    setError(null)
    if (!canSave) return
    services.projects.updateInputs(project.id, { economics: { scenario } })
      .then(setProject)
      .catch((reason: unknown) => {
        console.error('Не удалось сохранить выбор сценария', reason)
        setError(t.recommendation.chooseError)
      })
  }, [services, project.id, project.status, canSave])

  const save = useCallback(async (): Promise<Project | null> => {
    if (!canSave) return null
    setPending('save')
    setError(null)
    try {
      const saved = await services.projects.save(project.id)
      setProject(saved)
      return saved
    } catch (reason: unknown) {
      console.error('Не удалось сохранить оценку', reason)
      setError(t.footer.saveError)
      return null
    } finally {
      setPending(null)
    }
  }, [services, project.id, canSave])

  const requestQuote = useCallback(async (): Promise<boolean> => {
    setPending('quote')
    setError(null)
    try {
      setProject(await services.projects.requestQuote(project.id))
      return true
    } catch (reason: unknown) {
      console.error('Не удалось запросить КП', reason)
      setError(t.quote.error)
      return false
    } finally {
      setPending(null)
    }
  }, [services, project.id])

  return { load, retry, project, selected, pending, error, choose, save, requestQuote }
}
