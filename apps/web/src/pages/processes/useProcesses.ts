import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, OperationClass, OperationClassCode, Process } from '@/domain'
import { useServices } from '@/services/useServices'

export interface ProcessesData {
  readonly processes: readonly Process[]
  readonly operationClasses: readonly OperationClass[]
  readonly facilityTypes: readonly FacilityType[]
  /** Роботы каталога с классом процесса — совпадение по классу, не результат подбора (PRD 3.4). */
  readonly robotsByClass: Readonly<Record<OperationClassCode, number>>
}

export type ProcessesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & ProcessesData)

/** Данные экрана 07: все запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useProcesses(): { readonly state: ProcessesState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<ProcessesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.processes.listProcesses(),
      services.catalog.listOperationClasses(),
      services.locations.listFacilityTypes(),
      services.catalog.countRobotsByClass(),
    ])
      .then(([processes, operationClasses, facilityTypes, robotsByClass]) => {
        if (cancelled) return
        setState({ status: 'ready', processes, operationClasses, facilityTypes, robotsByClass })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить процессы', error)
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
