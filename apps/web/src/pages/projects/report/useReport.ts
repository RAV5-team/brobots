import { useCallback, useEffect, useState } from 'react'
import { projectOpenPath } from '@/app/routePaths'
import { canOpenStep, type Location, type Project, type ProjectId } from '@/domain'
import { NotFoundError } from '@/services/errors'
import { useServices } from '@/services/useServices'
import type { EconomicsData } from '../steps/economics/useEconomicsStep'

export interface ReportData extends EconomicsData {
  readonly project: Project
  readonly location: Location
}

export type ReportLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'notFound' }
  /** Итог черновика ещё закрыт — открыть шаг, где остановились. */
  | { readonly status: 'redirect'; readonly to: string }
  /** Проект есть, но вариант подбора не выбран — итога и отчёта нет. */
  | { readonly status: 'noSelection'; readonly project: Project }
  | { readonly status: 'ready'; readonly data: ReportData }

/** Прогон грузится отдельно: без него отчёт строится по расчёту подбора, как итог 08. */
function loadRun(services: ReturnType<typeof useServices>, runId: string | null) {
  if (!runId) return Promise.resolve(null)
  return services.projects.getSimulationRun(runId).catch((reason: unknown) => {
    console.error('Не удалось загрузить прогон для отчёта', reason)
    return null
  })
}

/**
 * Данные отчёта (PRD 11.6): те же ответы сервиса, что у итога 08 (экономика, подбор, снимок шага 1, прогон),
 * плюс проект и локация. Числа отчёта вычисляются теми же функциями — они совпадают с 08.
 */
export function useReport(projectId: ProjectId): { readonly load: ReportLoad; readonly retry: () => void } {
  const services = useServices()
  const [load, setLoad] = useState<ReportLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async (): Promise<ReportLoad> => {
      const project = await services.projects.getProject(projectId).catch((reason: unknown) => {
        if (reason instanceof NotFoundError) return null
        throw reason
      })
      if (!project) return { status: 'notFound' }
      if (!canOpenStep(project, 'economics')) return { status: 'redirect', to: projectOpenPath(project) }
      try {
        const [location, economics, matching, snapshot, simulationRun] = await Promise.all([
          services.locations.getLocation(project.locationId),
          services.projects.getEconomics(project.id),
          services.projects.getMatching(project.id),
          services.projects.getParamsSnapshot(project.id),
          loadRun(services, project.inputs.simulation?.runId ?? null),
        ])
        return { status: 'ready', data: { project, location, economics, matching, snapshot, run: simulationRun } }
      } catch (reason: unknown) {
        // Нет выбранного варианта — итога нет (как у 08), отчёт предлагает вернуться к подбору.
        if (reason instanceof NotFoundError) return { status: 'noSelection', project }
        throw reason
      }
    }
    run()
      .then((next) => { if (!cancelled) setLoad(next) })
      .catch((reason: unknown) => {
        if (cancelled) return
        console.error('Не удалось собрать отчёт', reason)
        setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, projectId, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { load, retry }
}
