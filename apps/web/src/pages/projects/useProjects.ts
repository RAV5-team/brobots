import { useCallback, useEffect, useState } from 'react'
import type { Location, Project } from '@/domain'
import { useServices } from '@/services/useServices'

export interface ProjectsData {
  /** Сначала недавно изменённые — так их отдаёт ProjectService. */
  readonly projects: readonly Project[]
  readonly locations: readonly Location[]
}

export type ProjectsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & ProjectsData)

/** Данные A1: проекты и названия объектов параллельно; ошибка любого запроса — экран ошибки с «Повторить» (D-07). */
export function useProjects(): { readonly state: ProjectsState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<ProjectsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([services.projects.listProjects(), services.locations.listLocations()])
      .then(([projects, locations]) => {
        if (cancelled) return
        setState({ status: 'ready', projects, locations })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить проекты', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
