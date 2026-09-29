import type { AdminService } from '../admin'
import type { CatalogService } from '../catalog'
import type { CompareService } from '../compare'
import type { DashboardService } from '../dashboard'
import { MissingApiError } from '../errors'
import type { Services } from '../index'
import type { LocationService } from '../locations'
import type { ProcessService } from '../processes'
import type { ProjectService } from '../projects'
import type { SessionService } from '../session'
import { createSimulationRuns } from '../simulationRuns'

const gaps = new Set<string>()
const listeners = new Set<() => void>()
// Один и тот же массив, пока набор не изменился: useSyncExternalStore сравнивает ссылку.
let snapshot: readonly string[] = []

/** Методы, которые экран запросил, а services/api их не отдаёт. */
export function apiGaps(): readonly string[] {
  return snapshot
}

export function subscribeApiGaps(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function missingMethod(service: string, method: string): Promise<never> {
  const key = `${service}.${method}`
  if (!gaps.has(key)) {
    gaps.add(key)
    snapshot = [...gaps]
    listeners.forEach((listener) => { listener() })
  }
  return Promise.reject(new MissingApiError(service, method))
}

function missing(service: string): object {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return () => { return missingMethod(service, prop) }
    },
  })
}

/** Запасная реализация режима API: ничего не выдумывает, каждый метод — ошибка «нет в API». */
export function createMissingServices(): Services {
  const projects = missing('projects') as ProjectService
  return {
    catalog: missing('catalog') as CatalogService,
    compare: missing('compare') as CompareService,
    processes: missing('processes') as ProcessService,
    locations: missing('locations') as LocationService,
    projects,
    simulationRuns: createSimulationRuns(projects),
    admin: missing('admin') as AdminService,
    session: missing('session') as SessionService,
    dashboard: missing('dashboard') as DashboardService,
  }
}
