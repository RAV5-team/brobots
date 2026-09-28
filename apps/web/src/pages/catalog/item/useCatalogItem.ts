import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, LaunchItem, Norm, OperationClass, Process, Robot } from '@/domain'
import { useServices } from '@/services/useServices'

export interface CatalogItemData {
  readonly robots: readonly Robot[]
  readonly launchItems: readonly LaunchItem[]
  readonly operationClasses: readonly OperationClass[]
  readonly processes: readonly Process[]
  readonly facilityTypes: readonly FacilityType[]
  /** Нормативы модели для фразы «ПО 10 %, ПНР 5 %» в «Что потребуется для запуска»; не загрузились — фразы нет. */
  readonly norms: readonly Norm[]
  /** Версия каталога сессии — в подписях источника характеристик. */
  readonly catalogVersion: string
}

export type CatalogItemState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & CatalogItemData)

/** Данные К-4: все запросы параллельно; ошибка любого, кроме нормативов, — экран ошибки с «Повторить» (D-07). */
export function useCatalogItem(): { readonly state: CatalogItemState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<CatalogItemState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listRobots(),
      services.catalog.listLaunchItems(),
      services.catalog.listOperationClasses(),
      services.processes.listProcesses(),
      services.locations.listFacilityTypes(),
      services.admin.listNorms().catch((error: unknown) => {
        console.error('Не удалось загрузить нормативы для страницы решения', error)
        return [] as readonly Norm[]
      }),
      services.session.getDataVersion(),
    ])
      .then(([robots, launchItems, operationClasses, processes, facilityTypes, norms, dataVersion]) => {
        if (!cancelled) setState({ status: 'ready', robots, launchItems, operationClasses, processes, facilityTypes, norms, catalogVersion: dataVersion.catalog })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить позицию каталога', error)
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
