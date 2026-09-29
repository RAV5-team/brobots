import { createHttpClient, type HttpClient } from '@/api/http'
import { getAccessToken } from '@/shared/auth/accessToken'
import { login, OIDC_ENABLED } from '@/shared/auth/oidc'
import { API_BASE_URL } from '@/shared/config/api'
import type { CatalogService, LocationService, ProcessService, Services } from '../index'
import { createMockCompare } from '../mock/compare'
import { createSimulationRuns } from '../simulationRuns'
import { apiAdmin } from './admin'
import { apiCatalog } from './catalog'
import { createMissingServices } from './missing'
import { apiDashboard, apiSession } from './overview'
import { apiLocations } from './locations'
import { apiProcesses } from './processes'
import { apiProjects } from './projects'
import { createReference } from './reference'

type DataServices = Omit<Services, 'simulationRuns'>

/** Методы, которые уже ходят в services/api; остальные остаются у запасной реализации. */
export type ApiOverrides = { readonly [K in keyof DataServices]?: Partial<DataServices[K]> }

/**
 * Сервисы поверх services/api. Чего в API ещё нет, не подменяется фикстурами: метод отвечает MissingApiError,
 * а экран показывает, какого вызова не хватает.
 */
/** Поля запасной реализации не копируются через spread: у «нет в API» это Proxy без собственных полей. */
function merge<T extends object>(fallback: T, override?: Partial<T>): T {
  if (!override) return fallback
  return new Proxy(fallback, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(override, prop)) {
        const value = override[prop as keyof T]
        if (value !== undefined) return value
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

export function composeServices(fallback: Services, overrides: ApiOverrides): Services {
  const projects = merge(fallback.projects, overrides.projects)
  return {
    catalog: merge(fallback.catalog, overrides.catalog),
    compare: merge(fallback.compare, overrides.compare),
    processes: merge(fallback.processes, overrides.processes),
    locations: merge(fallback.locations, overrides.locations),
    projects,
    simulationRuns: createSimulationRuns(projects),
    admin: merge(fallback.admin, overrides.admin),
    session: merge(fallback.session, overrides.session),
    dashboard: merge(fallback.dashboard, overrides.dashboard),
  }
}

/** Методы, уже переведённые на services/api. */
export function apiOverrides(http: HttpClient): ApiOverrides {
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
    session: apiSession(http),
    dashboard: apiDashboard(http),
  }
}

/** Набор сравнения хранится в браузере, отдельного эндпоинта нет — это не данные API. */
function withClientCompare(services: Services): Services {
  return { ...services, compare: createMockCompare({ latencyMs: 0 }) }
}

export function createApiServices(fallback: Services = withClientCompare(createMissingServices()), http: HttpClient = createDefaultHttpClient()): Services {
  return composeServices(fallback, apiOverrides(http))
}

/** 401 с Keycloak — на страницу входа: токен не обновился или сессию завершили в другом окне. */
export function createDefaultHttpClient(): HttpClient {
  return createHttpClient({
    baseUrl: API_BASE_URL,
    getToken: getAccessToken,
    ...(OIDC_ENABLED ? { onUnauthorized: () => { void login() } } : {}),
  })
}
