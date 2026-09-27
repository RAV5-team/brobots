import { useCallback, useEffect, useState } from 'react'
import { useServices } from '@/services/useServices'
import { buildOperationClassRows, countProcessesByClass, type OperationClassRow } from './operationClassesModel'

export type OperationClassesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly rows: readonly OperationClassRow[] }

/** Данные экрана А8: справочник, роботы по классу и библиотека процессов — параллельно (D-07). */
export function useOperationClasses(): {
  readonly state: OperationClassesState
  readonly retry: () => void
  /** Перечитать справочник без скелета — после создания класса (А10). */
  readonly reload: () => void
} {
  const services = useServices()
  const [state, setState] = useState<OperationClassesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listOperationClasses(),
      services.catalog.countRobotsByClass(),
      services.processes.listProcesses(),
    ])
      .then(([classes, robotsByClass, processes]) => {
        if (cancelled) return
        setState({ status: 'ready', rows: buildOperationClassRows(classes, robotsByClass, countProcessesByClass(processes)) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить классы операций', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const reload = useCallback(() => { setAttempt((n) => n + 1) }, [])

  return { state, retry, reload }
}
