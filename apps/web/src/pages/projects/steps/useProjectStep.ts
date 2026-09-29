import { useCallback, useEffect, useState } from 'react'
import { projectOpenPath } from '@/app/routePaths'
import { canOpenStep, type Location, type Project, type ProjectId, type ProjectStep } from '@/domain'
import { NotFoundError, requireId } from '@/services/errors'
import { useServices } from '@/services/useServices'

export type ProjectStepState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  /** Шаг черновика ещё закрыт — открыть тот, где остановились. */
  | { readonly status: 'redirect'; readonly to: string }
  | { readonly status: 'ready'; readonly project: Project; readonly location: Location }

/**
 * Данные шага: проект и его локация. Открытый шаг запоминается (черновик хранит самый дальний, PRD 11.1);
 * следующий шаг записывает CTA через `openStep`; закрытый шаг по URL — перенаправление, неизвестный проект —
 * «не найден», сбой — «Повторить» (D-07).
 */
export function useProjectStep(rawProjectId: ProjectId | null, step: ProjectStep): { readonly state: ProjectStepState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<ProjectStepState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<ProjectStepState> => {
      const projectId = requireId(rawProjectId, 'project')
      const project = await services.projects.getProject(projectId)
      if (!canOpenStep(project, step)) return { status: 'redirect', to: projectOpenPath(project) }
      const [opened, location] = await Promise.all([
        services.projects.openStep(projectId, step),
        services.locations.getLocation(project.locationId),
      ])
      return { status: 'ready', project: opened, location }
    }
    load()
      .then((next) => { if (!cancelled) setState(next) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось открыть шаг проекта', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, rawProjectId, step, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
