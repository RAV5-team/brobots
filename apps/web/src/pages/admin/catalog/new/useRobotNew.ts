import { useCallback, useEffect, useState } from 'react'
import type { HandlingMethod, OperationClass, Process, Robot } from '@/domain'
import { useServices } from '@/services/useServices'

export interface RobotNewData {
  /** Каталог: следующий идентификатор, список типов решений и проверка дублей. */
  readonly robots: readonly Robot[]
  readonly operationClasses: readonly OperationClass[]
  readonly handlingMethods: readonly HandlingMethod[]
  /** Справочник процессов — для подсказки «Робот попадёт в подбор для N процессов» (PRD 6.3). */
  readonly processes: readonly Process[]
}

export type RobotNewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & RobotNewData)

/** Справочники карточки А2: все запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useRobotNew(): { readonly state: RobotNewState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<RobotNewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listRobots(),
      services.catalog.listOperationClasses(),
      services.catalog.listHandlingMethods(),
      services.processes.listProcesses(),
    ])
      .then(([robots, operationClasses, handlingMethods, processes]) => {
        if (!cancelled) setState({ status: 'ready', robots, operationClasses, handlingMethods, processes })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить справочники карточки робота', error)
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
