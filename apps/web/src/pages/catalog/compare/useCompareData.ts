import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, LaunchItem, Location, LocationId, OperationClass, Process, Robot } from '@/domain'
import { useServices } from '@/services/useServices'

/**
 * Локация блока «Соответствие». Способа выбрать локацию на экране пока нет (D-58 — open);
 * до решения — демо-локация РЦ Химки (D-75).
 */
const DEMO_FIT_LOCATION_ID: LocationId = 'LOC-01'

export interface CompareData {
  readonly robots: readonly Robot[]
  readonly launchItems: readonly LaunchItem[]
  readonly location: Location | null
  /** Для характеристик робота — тех же, что на странице решения К-4 (D-76). */
  readonly operationClasses: readonly OperationClass[]
  readonly processes: readonly Process[]
  readonly facilityTypes: readonly FacilityType[]
}

export type CompareDataState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & CompareData)

/** Данные экрана К-3: каталог и локация — параллельно; локация не загрузилась — сравнение без блока «Соответствие». */
export function useCompareData(): { readonly state: CompareDataState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<CompareDataState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listRobots(),
      services.catalog.listLaunchItems(),
      services.locations.getLocation(DEMO_FIT_LOCATION_ID).catch((error: unknown) => {
        console.error('Не удалось загрузить локацию для блока «Соответствие»', error)
        return null
      }),
      services.catalog.listOperationClasses(),
      services.processes.listProcesses(),
      services.locations.listFacilityTypes(),
    ])
      .then(([robots, launchItems, location, operationClasses, processes, facilityTypes]) => {
        if (!cancelled) setState({ status: 'ready', robots, launchItems, location, operationClasses, processes, facilityTypes })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить каталог для сравнения', error)
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
