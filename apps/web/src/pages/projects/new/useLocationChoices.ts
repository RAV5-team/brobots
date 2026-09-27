import { useCallback, useEffect, useState } from 'react'
import { useServices } from '@/services/useServices'
import { locationChoices, type LocationChoice } from './newProjectModel'

export type LocationChoicesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly choices: readonly LocationChoice[] }

/** Локации пользователя и их сводки параллельно; перечитываются при каждом открытии окна (D-07). */
export function useLocationChoices(isOpen: boolean): { readonly state: LocationChoicesState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<LocationChoicesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelled = false
    Promise.all([services.locations.listLocations(), services.locations.listLocationSummaries()])
      .then(([locations, summaries]) => {
        if (!cancelled) setState({ status: 'ready', choices: locationChoices(locations, summaries) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить локации для нового проекта', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, isOpen, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
