import { createHttpClient, type HttpClient } from '@/api/http'
import { getAccessToken } from '@/shared/auth/accessToken'
import { API_BASE_URL } from '@/shared/config/api'
import type { Services } from '../index'
import { createMockServices } from '../mock'
import { createSimulationRuns } from '../simulationRuns'

type DataServices = Omit<Services, 'simulationRuns'>

/** Методы, которые уже ходят в services/api; остальные остаются у запасной реализации. */
export type ApiOverrides = { readonly [K in keyof DataServices]?: Partial<DataServices[K]> }

/**
 * Сервисы поверх services/api. Сервис переводится на API по методу: чего в API ещё нет, отвечает запасная
 * реализация (моки), поэтому экраны работают на каждом шаге интеграции.
 */
export function composeServices(fallback: Services, overrides: ApiOverrides): Services {
  const projects = { ...fallback.projects, ...overrides.projects }
  return {
    catalog: { ...fallback.catalog, ...overrides.catalog },
    compare: { ...fallback.compare, ...overrides.compare },
    processes: { ...fallback.processes, ...overrides.processes },
    locations: { ...fallback.locations, ...overrides.locations },
    projects,
    simulationRuns: createSimulationRuns(projects),
    admin: { ...fallback.admin, ...overrides.admin },
    session: { ...fallback.session, ...overrides.session },
    dashboard: { ...fallback.dashboard, ...overrides.dashboard },
  }
}

export function createApiServices(fallback: Services = createMockServices()): Services {
  return composeServices(fallback, {})
}

export function createDefaultHttpClient(onUnauthorized?: () => void): HttpClient {
  return createHttpClient({ baseUrl: API_BASE_URL, getToken: getAccessToken, ...(onUnauthorized ? { onUnauthorized } : {}) })
}
