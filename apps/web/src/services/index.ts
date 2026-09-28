import type { AdminService } from './admin'
import type { CatalogService } from './catalog'
import type { CompareService } from './compare'
import type { DashboardService } from './dashboard'
import type { LocationService } from './locations'
import type { ProcessService } from './processes'
import type { ProjectService } from './projects'
import type { SessionService } from './session'

/**
 * Все сервисы данных. Экраны получают их только через useServices(),
 * поэтому моки меняются на API без правок экранов.
 */
export interface Services {
  readonly catalog: CatalogService
  readonly compare: CompareService
  readonly processes: ProcessService
  readonly locations: LocationService
  readonly projects: ProjectService
  readonly admin: AdminService
  readonly session: SessionService
  readonly dashboard: DashboardService
}

export type { AdminService, CatalogService, CompareService, DashboardService, LocationService, ProcessService, ProjectService, SessionService }
export type { RobotFilter } from './catalog'
export { InvalidCredentialsError, NotFoundError, ValidationError } from './errors'
export type { Credentials } from './session'
