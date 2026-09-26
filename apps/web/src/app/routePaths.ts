import type { ProjectStep } from '@/domain'

// Маршруты приложения (D-22, proposed). Состояния и модалки живут на маршруте родителя.
export const ROUTE_PATHS = {
  login: '/login',
  dashboard: '/',

  processes: '/processes',
  processNew: '/processes/new',
  process: '/processes/:processId',

  locations: '/locations',
  locationNew: '/locations/new',
  location: '/locations/:locationId',
  locationProcesses: '/locations/:locationId/processes',
  locationProcess: '/locations/:locationId/processes/:locationProcessId',
  locationParams: '/locations/:locationId/params',
  locationDocuments: '/locations/:locationId/documents',

  catalog: '/catalog',

  projects: '/projects',
  projectParams: '/projects/:projectId/params',
  projectMatching: '/projects/:projectId/matching',
  projectSimulation: '/projects/:projectId/simulation',
  projectEconomics: '/projects/:projectId/economics',
  projectResult: '/projects/:projectId/result',
  projectReport: '/projects/:projectId/report',

  adminCatalog: '/admin/catalog',
  adminCatalogImport: '/admin/catalog/import',
  adminCatalogNew: '/admin/catalog/new',
  adminCatalogUpdate: '/admin/catalog/update',
  adminRobot: '/admin/catalog/:robotId',
  adminJournal: '/admin/journal',
  adminNorms: '/admin/norms',
  adminSources: '/admin/sources',
  adminOperationClasses: '/admin/operation-classes',

  integrations: '/integrations',
  profile: '/profile',
  help: '/help',
} as const

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS]

/** Куда открывать черновик проекта: на шаг, где пользователь остановился (PRD 11). */
export const PROJECT_STEP_PATHS = {
  params: ROUTE_PATHS.projectParams,
  matching: ROUTE_PATHS.projectMatching,
  simulation: ROUTE_PATHS.projectSimulation,
  economics: ROUTE_PATHS.projectEconomics,
} as const satisfies Record<ProjectStep, RoutePath>

// Служебные страницы разработки, в продуктовую навигацию не входят.
export const DEV_PATHS = {
  screens: '/dev/screens',
  tokens: '/dev/tokens',
  ui: '/dev/ui/:primitive?',
} as const
