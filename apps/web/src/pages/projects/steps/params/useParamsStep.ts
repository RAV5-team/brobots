import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssumptionOverride, LocationProcessId, Project, ProjectParamsSnapshot } from '@/domain'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'
import { withOverride, type AssumptionCode } from './paramsModel'

const t = ru.project.params.save

export type SnapshotState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: ProjectParamsSnapshot }

/** Решения шага 1: процесс и уточнённые допущения. У гостя и сохранённой оценки живут только на странице. */
interface ParamsDraft {
  readonly processId: LocationProcessId | null
  readonly overrides: readonly AssumptionOverride[]
}

export interface ParamsStepState {
  readonly snapshot: SnapshotState
  readonly retry: () => void
  readonly project: Project
  readonly draft: ParamsDraft
  /** Когда черновик сохранён последний раз в этой сессии; null — ещё не сохраняли. */
  readonly savedAt: string | null
  readonly saveError: string | null
  readonly selectProcess: (id: LocationProcessId) => void
  readonly refine: (code: AssumptionCode, next: AssumptionOverride | null) => void
}

/**
 * Данные и решения шага 1 (PRD 11.2). Пользователь в черновике — каждое решение сразу уходит в сервис (автосохранение, D-21);
 * гость проходит путь без сохранения (D-14), сохранённая оценка — только просмотр (D-17).
 */
export function useParamsStep(initial: Project, canSave: boolean): ParamsStepState {
  const services = useServices()
  const [snapshot, setSnapshot] = useState<SnapshotState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [project, setProject] = useState(initial)
  const [draft, setDraft] = useState<ParamsDraft>({ processId: initial.locationProcessId, overrides: initial.inputs.params.assumptions })
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Ответ устаревшего запроса не перезаписывает более позднее решение.
  const lastRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    services.projects.getParamsSnapshot(initial.id)
      .then((next) => { if (!cancelled) setSnapshot({ status: 'ready', snapshot: next }) })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить снимок шага «Параметры»', error)
        setSnapshot({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, initial.id, attempt])

  const retry = useCallback(() => {
    setSnapshot({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const persist = useCallback((request: () => Promise<Project>, failure: string) => {
    if (!canSave) return
    const id = lastRequest.current + 1
    lastRequest.current = id
    request()
      .then((saved) => {
        if (lastRequest.current !== id) return
        setProject(saved)
        setSavedAt(saved.updatedAt)
        setSaveError(null)
      })
      .catch((error: unknown) => {
        console.error('Не удалось сохранить шаг «Параметры»', error)
        if (lastRequest.current === id) setSaveError(failure)
      })
  }, [canSave])

  const selectProcess = useCallback((processId: LocationProcessId) => {
    // Допущения считались для прежнего процесса — у нового они исходные (D-94).
    setDraft({ processId, overrides: [] })
    persist(() => services.projects.selectProcess(initial.id, processId), t.processFailed)
  }, [persist, services, initial.id])

  const refine = useCallback((code: AssumptionCode, next: AssumptionOverride | null) => {
    const overrides = withOverride(draft.overrides, code, next)
    setDraft({ ...draft, overrides })
    persist(() => services.projects.updateInputs(initial.id, { params: { assumptions: overrides } }), t.failed)
  }, [draft, persist, services, initial.id])

  return { snapshot, retry, project, draft, savedAt, saveError, selectProcess, refine }
}
