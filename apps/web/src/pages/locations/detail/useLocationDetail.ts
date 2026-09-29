import { useCallback, useEffect, useState } from 'react'
import type { LocationId } from '@/domain'
import { NotFoundError, requireId } from '@/services/errors'
import type { Services } from '@/services'
import { useServices } from '@/services/useServices'
import type { LocationDetailData } from './locationDetailModel'

export type LocationDetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  | ({ readonly status: 'ready' } & LocationDetailData)

/** Локация и её сводка одним `GET /locations/{id}`, проекты только этой площадки, затем параметры типа объекта. */
async function loadLocationDetail(services: Services, locationId: LocationId | null): Promise<LocationDetailData> {
  const id = requireId(locationId, 'location')
  const [location, summary, facilityTypes, processes, locationProcesses, operationClasses, robotsByClass] =
    await Promise.all([
      services.locations.getLocation(id),
      services.locations.getLocationSummary(id),
      services.locations.listFacilityTypes(),
      services.processes.listProcesses(),
      services.locations.listLocationProcesses(id),
      services.catalog.listOperationClasses(),
      services.catalog.countRobotsByClass(),
    ])
  // У демо-локации — демо-проекты организатора, у своей — свои. Только эта площадка, не весь список.
  const [projects, parameters] = await Promise.all([
    services.projects.listProjects({ locationId: id, demo: location.isDemo === true }),
    services.locations.listFacilityParameters(location.facilityType),
  ])
  return {
    location,
    summary,
    facilityTypeName: facilityTypes.find((f) => f.code === location.facilityType)?.name ?? location.facilityType,
    facilityTypes,
    processes,
    locationProcesses,
    operationClasses,
    robotsByClass,
    projects: projects.filter((p) => p.locationId === id),
    parameters,
  }
}

/** Данные экрана 15: ошибка любого запроса — экран ошибки с «Повторить», неизвестный id — «не найдена» (D-07). */
export function useLocationDetail(id: LocationId | null): {
  readonly state: LocationDetailState
  readonly retry: () => void
  /** Перечитать данные без скелетона — после изменения процессов площадки (окно 15а). */
  readonly refresh: () => Promise<void>
} {
  const services = useServices()
  const [state, setState] = useState<LocationDetailState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadLocationDetail(services, id)
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось загрузить локацию', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    const data = await loadLocationDetail(services, id)
    setState({ status: 'ready', ...data })
  }, [services, id])

  return { state, retry, refresh }
}
