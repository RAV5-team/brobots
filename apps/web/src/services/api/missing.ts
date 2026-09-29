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
    listeners.forEach((listener) => listener())
  }
  return Promise.reject(new MissingApiError(service, method))
}

function missing<T extends object>(service: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return () => missingMethod(service, prop)
    },
  })
}

/** Запасная реализация режима API: ничего не выдумывает, каждый метод — ошибка «нет в API». */
export function createMissingServices(): Services {
  const projects = missing<ProjectService>('projects')
  return {
    catalog: missing<CatalogService>('catalog'),
    compare: missing<CompareService>('compare'),
    processes: missing<ProcessService>('processes'),
    locations: missing<LocationService>('locations'),
    projects,
    simulationRuns: createSimulationRuns(projects),
    admin: missing<AdminService>('admin'),
    session: missing<SessionService>('session'),
    dashboard: missing<DashboardService>('dashboard'),
  }
}
