import { useCallback, useEffect, useState } from 'react'
import { useServices } from '@/services/useServices'
import { DEMO_FILL } from '@/shared/auth/demoMode'
import { buildInitialForm, indexParameters, type LocationForm, type ParameterIndex, type ProfileText } from './locationForm'

/** Без демо-режима имя, город и адрес пустые: форма не предлагает имя, которое при сохранении даст дубль. */
const NO_DEMO_PROFILE: ProfileText = { name: '', city: '', address: '' }

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
    Promise.all([
      services.locations.listFacilityParameters('warehouse'),
      DEMO_FILL ? services.locations.getDemoProfile() : Promise.resolve(NO_DEMO_PROFILE),
    ])
      .then(([list, profile]) => {
        if (cancelled) return
        const params = indexParameters(list)
        setState({ status: 'ready', params, initialForm: buildInitialForm(params, profile) })
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
