import { useCallback, useEffect, useState } from 'react'
import type { DataVersion, Profile, Role } from '@/domain'
import { useServices } from '@/services/useServices'
import { buildDashboard, type Dashboard } from './dashboardModel'

export type DashboardState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly dashboard: Dashboard; readonly profile: Profile; readonly dataVersion: DataVersion }

/** Данные дашборда: все запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useDashboard(role: Role): { readonly state: DashboardState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<DashboardState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.locations.listLocations(),
      // Гостю — демо-данные организатора (ролевая модель, §3).
      services.projects.listProjects({ demo: role === 'guest' }),
      services.dashboard.getInputs(),
      services.session.getProfile(role),
      services.session.getDataVersion(),
    ])
      .then(([locations, projects, inputs, profile, dataVersion]) => {
        if (cancelled) return
        setState({ status: 'ready', dashboard: buildDashboard({ locations, projects, inputs }), profile, dataVersion })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить дашборд', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, role, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
