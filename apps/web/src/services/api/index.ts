import { createHttpClient, type HttpClient } from '@/api/http'
import { getAccessToken } from '@/shared/auth/accessToken'
import { login, OIDC_ENABLED } from '@/shared/auth/oidc'
import { API_BASE_URL } from '@/shared/config/api'
import type { CatalogService, LocationService, ProcessService, Services } from '../index'
import { createMockServices } from '../mock'
import { createSimulationRuns } from '../simulationRuns'
import { apiAdmin } from './admin'
import { apiCatalog } from './catalog'
import { apiDashboard, apiSession } from './overview'
import { apiLocations } from './locations'
import { apiProcesses } from './processes'
import { apiProjects } from './projects'
import { createReference } from './reference'

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

/** Методы, уже переведённые на services/api. */
export function apiOverrides(http: HttpClient, fallback: Services): ApiOverrides {
  const reference = createReference(http)
  const catalog = apiCatalog(http, reference) as CatalogService
  const processes = apiProcesses(http, reference) as ProcessService
  const locations = apiLocations(http, reference) as LocationService
  return {
    catalog,
    processes,
    locations,
    projects: apiProjects(http, { catalog, locations, processes }),
    admin: apiAdmin(http),
    session: apiSession(http, fallback.session),
    dashboard: apiDashboard(http),
  }
}

export function createApiServices(fallback: Services = createMockServices(), http: HttpClient = createDefaultHttpClient()): Services {
  return composeServices(fallback, apiOverrides(http, fallback))
}

/** 401 с Keycloak — на страницу входа: токен не обновился или сессию завершили в другом окне. */
export function createDefaultHttpClient(): HttpClient {
  return createHttpClient({
    baseUrl: API_BASE_URL,
    getToken: getAccessToken,
    ...(OIDC_ENABLED ? { onUnauthorized: () => { void login() } } : {}),
  })
}
