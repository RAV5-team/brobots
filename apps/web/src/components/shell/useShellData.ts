import { useEffect, useState } from 'react'
import type { DataVersion, Profile, Role } from '@/domain'
import { useServices } from '@/services/useServices'
import type { NavKey } from './navigation'

export interface ShellData {
  readonly counts: Readonly<Partial<Record<NavKey, number>>>
  readonly profile: Profile | null
  readonly dataVersion: DataVersion | null
}

const EMPTY: ShellData = { counts: {}, profile: null, dataVersion: null }

/** Данные меню: счётчики считаются из сервисов (D-13), профиль — по роли сессии. */
export function useShellData(role: Role): ShellData {
  const services = useServices()
  const [data, setData] = useState<ShellData>(EMPTY)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.projects.listProjects(),
      services.processes.listProcesses(),
      services.locations.listLocations(),
      services.catalog.listRobots(),
      services.session.getProfile(role),
      services.session.getDataVersion(),
    ])
      .then(([projects, processes, locations, robots, profile, dataVersion]) => {
        if (cancelled) return
        setData({
          counts: { projects: projects.length, processes: processes.length, locations: locations.length, catalog: robots.length },
          profile,
          dataVersion,
        })
      })
      .catch((error: unknown) => {
        // Меню работает и без счётчиков; ошибку видно в консоли разработчика.
        console.error('Не удалось загрузить данные меню', error)
      })
    return () => { cancelled = true }
  }, [services, role])

  return data
}
