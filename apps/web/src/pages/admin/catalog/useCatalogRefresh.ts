import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { isCatalogRefreshDone, type CatalogRefresh } from '@/domain'
import { useServices } from '@/services/useServices'

/** Как часто спрашивать статус опроса; столько же держим последний кадр, чтобы итог был виден. */
export const POLL_INTERVAL_MS = 1500

export type CatalogRefreshState =
  | { readonly status: 'starting' }
  | { readonly status: 'polling'; readonly refresh: CatalogRefresh }
  | { readonly status: 'error' }

/**
 * Опрос источников каталога (А1а, PRD 6.2): запуск, статус раз в POLL_INTERVAL_MS, по окончании — onDone.
 * Ошибка запроса не трогает каталог (ТЗ 4.3.4) — показываем повтор.
 */
export function useCatalogRefresh(onDone: () => void): { readonly state: CatalogRefreshState; readonly retry: () => void } {
  const services = useServices()
  const [state, setState] = useState<CatalogRefreshState>({ status: 'starting' })
  const [attempt, setAttempt] = useState(0)
  const finish = useEffectEvent(onDone)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const wait = () => new Promise<void>((resolve) => { timer = setTimeout(resolve, POLL_INTERVAL_MS) })

    const run = async () => {
      let refresh = await services.admin.startCatalogRefresh()
      while (!cancelled) {
        setState({ status: 'polling', refresh })
        // Отмена чистит таймер: после размонтирования ожидание не завершится.
        await wait()
        if (isCatalogRefreshDone(refresh)) {
          finish()
          return
        }
        refresh = await services.admin.getCatalogRefresh()
      }
    }

    run().catch((error: unknown) => {
      if (cancelled) return
      console.error('Не удалось опросить источники каталога', error)
      setState({ status: 'error' })
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [services, attempt])

  const retry = useCallback(() => {
    setState({ status: 'starting' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
