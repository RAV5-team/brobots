import { useCallback, useEffect, useState } from 'react'
import type { FacilityType } from '@/domain'
import { useServices } from '@/services/useServices'
import { buildListItems, type LocationListItem } from './locationsModel'

export type LocationsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly items: readonly LocationListItem[]; readonly facilityTypes: readonly FacilityType[] }

/** Данные экрана 12: запросы параллельно, ошибка любого — экран ошибки с «Повторить» (D-07). */
export function useLocations(): { readonly state: LocationsState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<LocationsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.locations.listLocations(),
      services.locations.listLocationSummaries(),
      services.locations.listFacilityTypes(),
    ])
      .then(([locations, summaries, facilityTypes]) => {
        if (cancelled) return
        setState({ status: 'ready', items: buildListItems(locations, summaries, facilityTypes), facilityTypes })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить локации', error)
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
