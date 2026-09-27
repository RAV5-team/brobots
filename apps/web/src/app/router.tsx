import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/shell/AppShell'
import { NotFound } from '@/pages/NotFound'
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
import { ScreenStub } from '@/pages/_stub/ScreenStub'
import { ScreensIndex } from '@/pages/dev/ScreensIndex'
import { TokensShowcase } from '@/pages/dev/TokensShowcase'
import { UiShowcase } from '@/pages/dev/ui/UiShowcase'
import { RootLayout } from './RootLayout'
import { DEV_PATHS, ROUTE_PATHS, type RoutePath } from './routePaths'

// Экран входа 05 живёт без меню; остальные разделы — внутри каркаса кабинета.
const OUTSIDE_SHELL: readonly RoutePath[] = [ROUTE_PATHS.login]
// Готовые экраны; остальные маршруты пока отдают заглушку.
const IMPLEMENTED: readonly RoutePath[] = [ROUTE_PATHS.dashboard, ROUTE_PATHS.processes, ROUTE_PATHS.processNew, ROUTE_PATHS.process, ROUTE_PATHS.locations, ROUTE_PATHS.locationNew, ROUTE_PATHS.location, ROUTE_PATHS.locationProcesses, ROUTE_PATHS.locationProcess, ROUTE_PATHS.locationParams, ROUTE_PATHS.locationDocuments]

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
          { path: ROUTE_PATHS.processes, element: <ProcessesPage /> },
          { path: ROUTE_PATHS.processNew, element: <ProcessNewPage /> },
          { path: ROUTE_PATHS.process, element: <ProcessDetailPage /> },
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
      { path: DEV_PATHS.screens, element: <ScreensIndex /> },
      { path: DEV_PATHS.tokens, element: <TokensShowcase /> },
      { path: DEV_PATHS.ui, element: <UiShowcase /> },
    ],
  },
]
