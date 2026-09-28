import { useCallback, useEffect, useState } from 'react'
import type { Location, LocationDocument, LocationId, LocationSummary } from '@/domain'
import { NotFoundError, requireId } from '@/services/errors'
import type { Services } from '@/services'
import { useServices } from '@/services/useServices'

export interface LocationDocumentsData {
  readonly location: Location
  /** Сводка для строки профиля в шапке; нет — строка без площади, персонала и смен. */
  readonly summary: LocationSummary | undefined
  readonly facilityTypeName: string
  readonly documents: readonly LocationDocument[]
}

export type LocationDocumentsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  | ({ readonly status: 'ready' } & LocationDocumentsData)

/** Локация, затем сводки, типы объектов и документы параллельно. */
async function loadLocationDocuments(services: Services, locationId: LocationId | null): Promise<LocationDocumentsData> {
  const id = requireId(locationId, 'location')
  const location = await services.locations.getLocation(id)
  const [summaries, facilityTypes, documents] = await Promise.all([
    services.locations.listLocationSummaries(),
    services.locations.listFacilityTypes(),
    services.locations.listLocationDocuments(id),
  ])
  return {
    location,
    summary: summaries.find((s) => s.locationId === id),
    facilityTypeName: facilityTypes.find((f) => f.code === location.facilityType)?.name ?? location.facilityType,
    documents,
  }
}

/** Данные вкладки 17б: ошибка — экран ошибки с «Повторить», неизвестный id — «не найдена» (D-07). */
export function useLocationDocuments(id: LocationId | null): {
  readonly state: LocationDocumentsState
  readonly retry: () => void
  /** Перечитать без скелетона — после загрузки документа. */
  readonly refresh: () => Promise<void>
} {
  const services = useServices()
  const [state, setState] = useState<LocationDocumentsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadLocationDocuments(services, id)
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось загрузить документы локации', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    const data = await loadLocationDocuments(services, id)
    setState({ status: 'ready', ...data })
  }, [services, id])

  return { state, retry, refresh }
}
