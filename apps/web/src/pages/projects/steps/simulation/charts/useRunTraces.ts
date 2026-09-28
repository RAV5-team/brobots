import { useCallback, useEffect, useState } from 'react'
import type { SimulationTrace } from '@/domain'
import { useServices } from '@/services/useServices'

export type RunTracesLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly traces: readonly SimulationTrace[] }

type Fetched = { readonly runId: string; readonly traces: readonly SimulationTrace[] | null } | null

/**
 * 2D-трассы прогона (`GET /api/simulations/{id}/traces`): «из подбора» и, если состав изменился, итоговая.
 * Файлы тяжёлые — грузятся только на вкладке 07a, отдельным чанком (docs/spike-2d.md).
 */
export function useRunTraces(runId: string): { readonly load: RunTracesLoad; readonly retry: () => void } {
  const services = useServices()
  const [fetched, setFetched] = useState<Fetched>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    services.projects.getSimulationTraces(runId)
      .then((traces) => { if (!cancelled) setFetched({ runId, traces }) })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить 2D-трассы прогона', error)
        setFetched({ runId, traces: null })
      })
    return () => { cancelled = true }
  }, [services, runId, attempt])

  const retry = useCallback(() => {
    setFetched(null)
    setAttempt((n) => n + 1)
  }, [])

  if (fetched?.runId !== runId) return { load: { status: 'loading' }, retry }
  return { load: fetched.traces === null ? { status: 'error' } : { status: 'ready', traces: fetched.traces }, retry }
}
