import { useCallback, useEffect, useState } from 'react'
import type { FacilityType, LaunchItem, LaunchItemType, OperationClass, Process, Robot } from '@/domain'
import { useServices } from '@/services/useServices'
import { launchTypesOf, type CatalogTab } from './catalogModel'

export interface CatalogData {
  readonly robots: readonly Robot[]
  readonly launchItems: readonly LaunchItem[]
  readonly operationClasses: readonly OperationClass[]
  readonly facilityTypes: readonly FacilityType[]
  /** Нужны, чтобы вывести тип объекта робота через классы операций (D-72). */
  readonly processes: readonly Process[]
}

export type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & CatalogData)

/** Раздел вкладки: роботы готовы сразу, остальные виды — когда вкладка открыта. */
export type CatalogSection = 'idle' | 'loading' | 'error'

/**
 * Данные экрана К-1. На старте — роботы и справочники. Инфраструктура, ПО и сервисы
 * запрашиваются, когда открыта их вкладка, в том числе по ссылке `?tab=` (D-07).
 */
export function useCatalog(tab: CatalogTab): {
  readonly state: CatalogState
  readonly section: CatalogSection
  readonly retry: () => void
  readonly retrySection: () => void
} {
  const services = useServices()
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [launchItems, setLaunchItems] = useState<readonly LaunchItem[]>([])
  const [loaded, setLoaded] = useState<ReadonlySet<LaunchItemType>>(() => new Set())
  const [sectionError, setSectionError] = useState(false)
  const [sectionAttempt, setSectionAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      services.catalog.listRobots(),
      services.catalog.listOperationClasses(),
      services.locations.listFacilityTypes(),
      services.processes.listProcesses(),
    ])
      .then(([robots, operationClasses, facilityTypes, processes]) => {
        if (!cancelled) setState({ status: 'ready', robots, launchItems: [], operationClasses, facilityTypes, processes })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить каталог', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt])

  const missing = launchTypesOf(tab).filter((type) => !loaded.has(type))
  const missingKey = missing.join(',')

  useEffect(() => {
    if (missingKey === '') {
      setSectionError(false)
      return
    }
    const types = missingKey.split(',') as LaunchItemType[]
    let cancelled = false
    setSectionError(false)
    services.catalog.listLaunchItems(types)
      .then((items) => {
        if (cancelled) return
        setLaunchItems((prev) => {
          const ids = new Set(prev.map((item) => item.id))
          return [...prev, ...items.filter((item) => !ids.has(item.id))]
        })
        setLoaded((prev) => new Set([...prev, ...types]))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить раздел каталога', error)
        setSectionError(true)
      })
    return () => { cancelled = true }
  }, [services, missingKey, sectionAttempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setLaunchItems([])
    setLoaded(new Set())
    setSectionError(false)
    setAttempt((n) => n + 1)
  }, [])

  const retrySection = useCallback(() => {
    setSectionError(false)
    setSectionAttempt((n) => n + 1)
  }, [])

  const view: CatalogState = state.status === 'ready' ? { ...state, launchItems } : state
  const section: CatalogSection = missing.length === 0 ? 'idle' : sectionError ? 'error' : 'loading'
  return { state: view, section, retry, retrySection }
}
