import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, LaunchItem, OperationClass, Process, Robot } from '@/domain'
import { useServices } from '@/services/useServices'

export interface CatalogData {
  readonly robots: readonly Robot[]
  readonly launchItems: readonly LaunchItem[]
  readonly operationClasses: readonly OperationClass[]
  readonly facilityTypes: readonly FacilityType[]
  /** Нужны, чтобы вывести тип объекта робота через классы операций (D-72). */
  readonly processes: readonly Process[]
}

export type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & CatalogData)

/** Данные экрана К-1: все запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useCatalog(): { readonly state: CatalogState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listRobots(),
      services.catalog.listLaunchItems(),
      services.catalog.listOperationClasses(),
      services.locations.listFacilityTypes(),
      services.processes.listProcesses(),
    ])
      .then(([robots, launchItems, operationClasses, facilityTypes, processes]) => {
        if (!cancelled) setState({ status: 'ready', robots, launchItems, operationClasses, facilityTypes, processes })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить каталог', error)
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
