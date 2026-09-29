import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { projectStepPath } from '@/app/routePaths'
import type { ProjectId, ProjectStep } from '@/domain'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.page

/**
 * CTA шага: записать следующий `current_step`, затем перейти. Гость и сохранённая оценка — только переход:
 * гость не сохраняет (D-14), у готовой оценки все шаги уже открыты.
 */
export function useAdvanceStep(projectId: ProjectId, persist: boolean): {
  readonly go: (step: ProjectStep) => Promise<void>
  readonly busy: boolean
  readonly error: string | null
} {
  const services = useServices()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = useCallback(async (step: ProjectStep) => {
    if (!persist) {
      await navigate(projectStepPath(projectId, step))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await services.projects.openStep(projectId, step)
      await navigate(projectStepPath(projectId, step))
    } catch (cause: unknown) {
      console.error('Не удалось открыть следующий шаг проекта', cause)
      setError(t.advanceFailed)
      setBusy(false)
      throw cause
    }
  }, [navigate, persist, projectId, services])

  return { go, busy, error }
}
