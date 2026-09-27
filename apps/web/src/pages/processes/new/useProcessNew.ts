import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, HandlingMethod, Location, OperationClass, OperationClassCode, Process } from '@/domain'
import { useServices } from '@/services/useServices'
import type { ProcessForm } from './processForm'
import { buildDemoForm, warehouseBase, type WarehouseBase } from './processNew.mock'

export interface ProcessNewData {
  readonly operationClasses: readonly OperationClass[]
  readonly handlingMethods: readonly HandlingMethod[]
  readonly facilityTypes: readonly FacilityType[]
  readonly locations: readonly Location[]
  readonly processes: readonly Process[]
  /** Роботы каталога по классу — для строки «Роботов с этим классом» (PRD 3.4). */
  readonly robotsByClass: Readonly<Record<OperationClassCode, number>>
  readonly base: WarehouseBase
  readonly initialForm: ProcessForm
}

export type ProcessNewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & ProcessNewData)

/** Справочники формы 09а: все запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useProcessNew(): { readonly state: ProcessNewState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<ProcessNewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listOperationClasses(),
      services.catalog.listHandlingMethods(),
      services.catalog.countRobotsByClass(),
      services.locations.listFacilityTypes(),
      services.locations.listLocations(),
      services.locations.listFacilityParameters('warehouse'),
      services.processes.listProcesses(),
    ])
      .then(([operationClasses, handlingMethods, robotsByClass, facilityTypes, locations, params, processes]) => {
        if (cancelled) return
        setState({
          status: 'ready',
          operationClasses,
          handlingMethods,
          robotsByClass,
          facilityTypes,
          locations,
          processes,
          base: warehouseBase(params),
          initialForm: buildDemoForm(params),
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить справочники формы процесса', error)
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
