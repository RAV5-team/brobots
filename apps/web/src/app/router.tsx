import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/shell/AppShell'
import { NotFound } from '@/pages/NotFound'
import { AdminCatalogImportPage } from '@/pages/admin/catalog/AdminCatalogImportPage'
import { AdminCatalogPage } from '@/pages/admin/catalog/AdminCatalogPage'
import { RobotNewPage } from '@/pages/admin/catalog/new/RobotNewPage'
import { NormsPage } from '@/pages/admin/norms/NormsPage'
import { DataSourcesPage } from '@/pages/admin/sources/DataSourcesPage'
import { OperationClassesPage } from '@/pages/admin/operation-classes/OperationClassesPage'
import { CatalogPage } from '@/pages/catalog/CatalogPage'
import { ComparePage } from '@/pages/catalog/compare/ComparePage'
import { CatalogItemPage } from '@/pages/catalog/item/CatalogItemPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LocationsPage } from '@/pages/locations/LocationsPage'
import { LocationPage } from '@/pages/locations/detail/LocationPage'
import { LocationDocumentsPage } from '@/pages/locations/documents/LocationDocumentsPage'
import { LocationNewPage } from '@/pages/locations/new/LocationNewPage'
import { LocationParamsPage } from '@/pages/locations/params/LocationParamsPage'
import { LocationProcessPage } from '@/pages/locations/process/LocationProcessPage'
import { LoginPage } from '@/pages/login/LoginPage'
import { ProcessesPage } from '@/pages/processes/ProcessesPage'
import { ProcessDetailPage } from '@/pages/processes/detail/ProcessDetailPage'
import { ProcessNewPage } from '@/pages/processes/new/ProcessNewPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectStepPage } from '@/pages/projects/steps/ProjectStepPage'
import { ScreenStub } from '@/pages/_stub/ScreenStub'
import { ProjectResultRedirect } from './ProjectResultRedirect'
import { RootLayout } from './RootLayout'
import type { ProjectStep } from '@/domain'
import { DEV_PATHS, LEGACY_PATHS, PROJECT_STEP_PATHS, ROUTE_PATHS, type RoutePath } from './routePaths'

// Экран входа 05 живёт без меню; остальные разделы — внутри каркаса кабинета.
const OUTSIDE_SHELL: readonly RoutePath[] = [ROUTE_PATHS.login]
// Готовые экраны; остальные маршруты пока отдают заглушку.
const IMPLEMENTED: readonly RoutePath[] = [
  ROUTE_PATHS.dashboard, ROUTE_PATHS.projects, ROUTE_PATHS.catalog, ROUTE_PATHS.catalogCompare, ROUTE_PATHS.catalogItem, ROUTE_PATHS.processes, ROUTE_PATHS.processNew, ROUTE_PATHS.process,
  ROUTE_PATHS.locations, ROUTE_PATHS.locationNew, ROUTE_PATHS.location, ROUTE_PATHS.locationProcesses, ROUTE_PATHS.locationProcess, ROUTE_PATHS.locationParams, ROUTE_PATHS.locationDocuments,
  ROUTE_PATHS.adminCatalog, ROUTE_PATHS.adminCatalogImport, ROUTE_PATHS.adminCatalogNew, ROUTE_PATHS.adminNorms, ROUTE_PATHS.adminSources, ROUTE_PATHS.adminOperationClasses,
  ...Object.values(PROJECT_STEP_PATHS),
]

// Шаги проекта — один каркас (ProjectStepPage), шаг — по ProjectStep (D-22).
const projectStepRoutes: RouteObject[] = (Object.entries(PROJECT_STEP_PATHS) as [ProjectStep, RoutePath][])
  .map(([step, path]) => ({ path, element: <ProjectStepPage key={step} step={step} /> }))

const stubRoute = (path: RoutePath): RouteObject => ({ path, element: <ScreenStub route={path} /> })

// Пока экраны не реализованы, каждый маршрут отдаёт заглушку со списком своих экранов.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: ROUTE_PATHS.dashboard, element: <DashboardPage /> },
          { path: ROUTE_PATHS.projects, element: <ProjectsPage /> },
          { path: LEGACY_PATHS.projectResult, element: <ProjectResultRedirect /> },
          ...projectStepRoutes,
          { path: ROUTE_PATHS.catalog, element: <CatalogPage /> },
          { path: ROUTE_PATHS.catalogCompare, element: <ComparePage /> },
          { path: ROUTE_PATHS.catalogItem, element: <CatalogItemPage /> },
          { path: ROUTE_PATHS.processes, element: <ProcessesPage /> },
          { path: ROUTE_PATHS.processNew, element: <ProcessNewPage /> },
          { path: ROUTE_PATHS.process, element: <ProcessDetailPage /> },
          { path: ROUTE_PATHS.adminCatalog, element: <AdminCatalogPage /> },
          { path: ROUTE_PATHS.adminCatalogImport, element: <AdminCatalogImportPage /> },
          { path: ROUTE_PATHS.adminCatalogNew, element: <RobotNewPage /> },
          { path: ROUTE_PATHS.adminNorms, element: <NormsPage /> },
          { path: ROUTE_PATHS.adminSources, element: <DataSourcesPage /> },
          { path: ROUTE_PATHS.adminOperationClasses, element: <OperationClassesPage /> },
          { path: ROUTE_PATHS.locations, element: <LocationsPage /> },
          { path: ROUTE_PATHS.locationNew, element: <LocationNewPage /> },
          { path: ROUTE_PATHS.location, element: <LocationPage /> },
          { path: ROUTE_PATHS.locationProcesses, element: <LocationPage /> },
          { path: ROUTE_PATHS.locationProcess, element: <LocationProcessPage /> },
          { path: ROUTE_PATHS.locationParams, element: <LocationParamsPage /> },
          { path: ROUTE_PATHS.locationDocuments, element: <LocationDocumentsPage /> },
          ...Object.values(ROUTE_PATHS)
            .filter((p) => !OUTSIDE_SHELL.includes(p) && !IMPLEMENTED.includes(p))
            .map(stubRoute),
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: ROUTE_PATHS.login, element: <LoginPage /> },
      // Служебные страницы грузятся по требованию: в основной бандл кабинета они не входят (бюджет 300 КБ gzip).
      { path: DEV_PATHS.screens, lazy: async () => ({ Component: (await import('@/pages/dev/ScreensIndex')).ScreensIndex }) },
      { path: DEV_PATHS.tokens, lazy: async () => ({ Component: (await import('@/pages/dev/TokensShowcase')).TokensShowcase }) },
      { path: DEV_PATHS.ui, lazy: async () => ({ Component: (await import('@/pages/dev/ui/UiShowcase')).UiShowcase }) },
      { path: DEV_PATHS.spike2d, lazy: async () => ({ Component: (await import('@/pages/dev/spike2d/Spike2dPage')).Spike2dPage }) },
    ],
  },
]
