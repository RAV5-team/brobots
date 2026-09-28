import { useCallback, useEffect, useState } from 'react'
import type {
  FacilityParameter, FacilityType, FacilityTypeCode, Location, LocationProcess, OperationClass, Process, ProcessCode, ProcessRequirements, Robot,
} from '@/domain'
import { NotFoundError } from '@/services/errors'
import { useServices } from '@/services/useServices'

export interface ProcessDetailData {
  readonly process: Process
  /** Что процесс запрашивает у локации (PRD 9.3), без объёма потока. */
  readonly requirements: ProcessRequirements
  readonly operationClass: OperationClass | undefined
  readonly facilityTypes: readonly FacilityType[]
  /** Роботы каталога с классом процесса — совпадение по классу, не результат подбора (PRD 3.4). */
  readonly robots: readonly Robot[]
  readonly locations: readonly Location[]
  readonly locationProcesses: readonly LocationProcess[]
  readonly parameters: Readonly<Partial<Record<FacilityTypeCode, readonly FacilityParameter[]>>>
}

export type ProcessDetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  | ({ readonly status: 'ready' } & ProcessDetailData)

/** Данные экрана 11: процесс, затем справочники, каталог и локации параллельно; ошибка любого — экран ошибки (D-07). */
export function useProcessDetail(code: ProcessCode): { readonly state: ProcessDetailState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<ProcessDetailState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<ProcessDetailData> => {
      const process = await services.processes.getProcess(code)
      const [requirements, operationClasses, facilityTypes, robots, locations] = await Promise.all([
        services.processes.getRequirements(process.code),
        services.catalog.listOperationClasses(),
        services.locations.listFacilityTypes(),
        services.catalog.listRobots({ operationClass: process.operationClass }),
        services.locations.listLocations(),
      ])
      const usedTypes = [...new Set(locations.map((l) => l.facilityType))]
      const [locationProcesses, parameterLists] = await Promise.all([
        Promise.all(locations.map((l) => services.locations.listLocationProcesses(l.id))).then((lists) => lists.flat()),
        Promise.all(usedTypes.map((type) => services.locations.listFacilityParameters(type))),
      ])
      return {
        process,
        requirements,
        operationClass: operationClasses.find((c) => c.code === process.operationClass),
        facilityTypes,
        robots,
        locations,
        locationProcesses,
        parameters: Object.fromEntries(usedTypes.map((type, i) => [type, parameterLists[i] ?? []])),
      }
    }
    load()
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось загрузить процесс', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, code, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
