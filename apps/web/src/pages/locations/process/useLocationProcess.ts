import { useCallback, useEffect, useState } from 'react'
import type {
  FacilityParameter, FacilityType, HandlingMethod, Location, LocationId, LocationProcess, LocationProcessId, OperationClass,
  OperationClassCode, Process, ProcessTemplateDefaults,
} from '@/domain'
import type { Services } from '@/services'
import { NotFoundError } from '@/services/errors'
import { useServices } from '@/services/useServices'

export interface LocationProcessData {
  readonly location: Location
  readonly locationProcess: LocationProcess
  /** Шаблон справочника, копией которого является процесс на локации. */
  readonly process: Process
  readonly processes: readonly Process[]
  readonly operationClasses: readonly OperationClass[]
  readonly handlingMethods: readonly HandlingMethod[]
  readonly facilityTypes: readonly FacilityType[]
  readonly robotsByClass: Readonly<Partial<Record<OperationClassCode, number>>>
  /** Параметры типа объекта локации — база датасета для значений, которых нет в профиле. */
  readonly parameters: readonly FacilityParameter[]
  /** Значения по умолчанию формы 09а для полей, которых у шаблона нет (PRD 15 · №22). */
  readonly templateDefaults: ProcessTemplateDefaults
}

export type LocationProcessState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  | ({ readonly status: 'ready' } & LocationProcessData)

/** Локация, затем процессы площадки и справочники параллельно; чужой или неизвестный процесс — «не найден». */
async function loadLocationProcess(services: Services, locationId: LocationId, id: LocationProcessId): Promise<LocationProcessData> {
  const location = await services.locations.getLocation(locationId)
  const [locationProcesses, processes, operationClasses, handlingMethods, facilityTypes, robotsByClass, parameters, templateDefaults] = await Promise.all([
    services.locations.listLocationProcesses(locationId),
    services.processes.listProcesses(),
    services.catalog.listOperationClasses(),
    services.catalog.listHandlingMethods(),
    services.locations.listFacilityTypes(),
    services.catalog.countRobotsByClass(),
    services.locations.listFacilityParameters(location.facilityType),
    services.processes.getTemplateDefaults(),
  ])
  const locationProcess = locationProcesses.find((lp) => lp.id === id)
  const process = processes.find((p) => p.code === locationProcess?.processCode)
  if (!locationProcess || !process) throw new NotFoundError(`Процесс ${id} на локации ${locationId} не найден`)
  return { location, locationProcess, process, processes, operationClasses, handlingMethods, facilityTypes, robotsByClass, parameters, templateDefaults }
}

/** Данные экрана 16: ошибка любого запроса — экран ошибки с «Повторить» (D-07). */
export function useLocationProcess(locationId: LocationId, id: LocationProcessId): {
  readonly state: LocationProcessState
  readonly retry: () => void
} {
  const services = useServices()
  const [state, setState] = useState<LocationProcessState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadLocationProcess(services, locationId, id)
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось загрузить процесс на локации', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, locationId, id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
