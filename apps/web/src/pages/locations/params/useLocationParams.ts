import { useCallback, useEffect, useState } from 'react'
import type { Location, LocationId, LocationSummary } from '@/domain'
import { NotFoundError, requireId } from '@/services/errors'
import type { Services } from '@/services'
import { useServices } from '@/services/useServices'
import { indexParameters, type ParameterIndex } from '../new/locationForm'

export interface LocationParamsData {
  readonly location: Location
  /** Сводка для строки профиля в шапке; нет — строка без площади, персонала и смен. */
  readonly summary: LocationSummary | undefined
  readonly facilityTypeName: string
  /** Параметры склада из датасета: диапазоны, подсказки, норматив начислений — как у формы 14. */
  readonly params: ParameterIndex
}

export type LocationParamsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  | ({ readonly status: 'ready' } & LocationParamsData)

/**
 * Локация, затем сводки, типы объектов и параметры склада параллельно. Параметры всегда складские:
 * разделы формы есть только у склада (D-36), у других типов вкладка показывает «Основное».
 */
async function loadLocationParams(services: Services, locationId: LocationId | null): Promise<LocationParamsData> {
  const id = requireId(locationId, 'location')
  const location = await services.locations.getLocation(id)
  const [summaries, facilityTypes, parameters] = await Promise.all([
    services.locations.listLocationSummaries(),
    services.locations.listFacilityTypes(),
    services.locations.listFacilityParameters('warehouse'),
  ])
  return {
    location,
    summary: summaries.find((s) => s.locationId === id),
    facilityTypeName: facilityTypes.find((f) => f.code === location.facilityType)?.name ?? location.facilityType,
    params: indexParameters(parameters),
  }
}

/** Данные вкладки 17а: ошибка — экран ошибки с «Повторить», неизвестный id — «не найдена» (D-07). */
export function useLocationParams(id: LocationId | null): {
  readonly state: LocationParamsState
  readonly retry: () => void
  /** Перечитать без скелетона — после сохранения профиля: шапка и дата «Обновлено» меняются. */
  readonly refresh: () => Promise<void>
} {
  const services = useServices()
  const [state, setState] = useState<LocationParamsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadLocationParams(services, id)
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof NotFoundError) {
          setState({ status: 'notFound' })
          return
        }
        console.error('Не удалось загрузить параметры локации', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    const data = await loadLocationParams(services, id)
    setState({ status: 'ready', ...data })
  }, [services, id])

  return { state, retry, refresh }
}
