import { generatePath } from 'react-router'
import type { Project, ProjectId, ProjectStep } from '@/domain'

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
  // «compare» объявлен раньше «:itemId» (D-68): сравнение К-3 — не страница позиции.
  catalogCompare: '/catalog/compare',
  catalogItem: '/catalog/:itemId',

  projects: '/projects',
  projectParams: '/projects/:projectId/params',
  projectMatching: '/projects/:projectId/matching',
  projectSimulation: '/projects/:projectId/simulation',
  projectEconomics: '/projects/:projectId/economics',
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

/** Путь шага проекта — ключ и адрес по ProjectStep (4 шага PRD 0.9; итог и экономика — один шаг). */
export const PROJECT_STEP_PATHS = {
  params: ROUTE_PATHS.projectParams,
  matching: ROUTE_PATHS.projectMatching,
  simulation: ROUTE_PATHS.projectSimulation,
  economics: ROUTE_PATHS.projectEconomics,
} as const satisfies Record<ProjectStep, RoutePath>

export function projectStepPath(projectId: ProjectId, step: ProjectStep): string {
  return generatePath(PROJECT_STEP_PATHS[step], { projectId })
}

/** Куда открывать проект: черновик — на его шаг, сохранённая оценка — на итог, только просмотр (D-17, D-22). */
export function projectOpenPath(project: Project): string {
  return projectStepPath(project.id, project.status === 'draft' ? project.step : 'economics')
}

/** Старые адреса, которые перенаправляются: сохранённая оценка жила на отдельном `/result` (D-22). */
export const LEGACY_PATHS = {
  projectResult: '/projects/:projectId/result',
} as const

// Служебные страницы разработки, в продуктовую навигацию не входят.
export const DEV_PATHS = {
  screens: '/dev/screens',
  tokens: '/dev/tokens',
  ui: '/dev/ui/:primitive?',
} as const
