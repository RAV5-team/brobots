import { useCallback, useEffect, useState } from 'react'
import type { RobotId } from '@/domain'
import { useServices } from '@/services/useServices'
import { buildCatalogRows, type CatalogRow } from './catalogModel'

export type AdminCatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly rows: readonly CatalogRow[] }

/**
 * Данные экрана А1: весь каталог решений (D-07 — загрузка, ошибка с повтором).
 * addedId — решение, сохранённое на А2: его строка поднимается за очередь подтверждения (А3).
 */
export function useAdminCatalog(addedId: RobotId | null = null): { readonly state: AdminCatalogState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<AdminCatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    services.catalog
      .listRobots()
      .then((robots) => {
        if (cancelled) return
        setState({ status: 'ready', rows: buildCatalogRows(robots, Date.now(), addedId) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить каталог решений', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt, addedId])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
