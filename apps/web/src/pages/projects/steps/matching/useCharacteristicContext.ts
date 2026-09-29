import { useEffect, useState } from 'react'
import type { CharacteristicContext } from '@/pages/catalog/characteristics'
import { useServices } from '@/services/useServices'

export type ContextLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly ctx: CharacteristicContext }

/** Справочники для характеристик К-4 — только когда окно открыто: стартовый экран 2.1 их не грузит. */
export function useCharacteristicContext(catalogVersion: string): ContextLoad {
  const services = useServices()
  const [load, setLoad] = useState<ContextLoad>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    Promise.all([services.catalog.listOperationClasses(), services.processes.listProcesses(), services.locations.listFacilityTypes()])
      .then(([operationClasses, processes, facilityTypes]) => {
        if (!cancelled) setLoad({ status: 'ready', ctx: { operationClasses, processes, facilityTypes, catalogVersion } })
      })
      .catch((error: unknown) => {
        console.error('Не удалось загрузить справочники для окна решения', error)
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, catalogVersion])
  return load
}
