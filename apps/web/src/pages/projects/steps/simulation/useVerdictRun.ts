import { useCallback, useEffect, useState } from 'react'
import type { SimulationRun } from '@/domain'
import { useServices } from '@/services/useServices'

export type VerdictRunLoad =
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly run: SimulationRun }

/** Ответ по конкретному прогону: загрузка другого id — снова «загружается». */
type Fetched = { readonly runId: string; readonly run: SimulationRun | null } | null

/** Прогон вердикта (`GET /api/simulations/{id}`): грузится, только когда открыт этап 4 и прогон есть. */
export function useVerdictRun(runId: string | null, enabled: boolean): { readonly load: VerdictRunLoad; readonly retry: () => void } {
  const services = useServices()
  const [fetched, setFetched] = useState<Fetched>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || runId === null) return
    let cancelled = false
    services.projects.getSimulationRun(runId)
      .then((run) => { if (!cancelled) setFetched({ runId, run }) })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить прогон симуляции', error)
        setFetched({ runId, run: null })
      })
    return () => { cancelled = true }
  }, [services, runId, enabled, attempt])

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((n) => n + 1)
  }, [])

  if (runId === null) return { load: { status: 'none' }, retry }
  if (fetched?.runId !== runId) return { load: { status: 'loading' }, retry }
  return { load: fetched.run === null ? { status: 'error' } : { status: 'ready', run: fetched.run }, retry }
}
