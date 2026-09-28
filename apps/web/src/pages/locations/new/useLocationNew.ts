import { useCallback, useEffect, useState } from 'react'
import { useServices } from '@/services/useServices'
import { buildInitialForm, indexParameters, type LocationForm, type ParameterIndex } from './locationForm'
import { LOCATION_DEMO_PROFILE } from './locationNew.mock'

export interface LocationNewData {
  /** Параметры склада из датасета: диапазоны, подсказки, норматив начислений. */
  readonly params: ParameterIndex
  readonly initialForm: LocationForm
}

export type LocationNewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & LocationNewData)

/** Справочник параметров склада для формы 14; ошибка — экран ошибки с «Повторить» (D-07). */
export function useLocationNew(): { readonly state: LocationNewState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<LocationNewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    services.locations
      .listFacilityParameters('warehouse')
      .then((list) => {
        if (cancelled) return
        const params = indexParameters(list)
        setState({ status: 'ready', params, initialForm: buildInitialForm(params, LOCATION_DEMO_PROFILE) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить параметры склада для формы локации', error)
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
