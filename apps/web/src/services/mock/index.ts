import type { Services } from '../index'
import { createMockAdmin } from './admin'
import { createMockCatalog } from './catalog'
import { createMockCompare } from './compare'
import { createMockDashboard } from './dashboard'
import { createMockLocations } from './locations'
import { createMockProcesses } from './processes'
import { createMockProjects } from './projects'
import type { MockOptions } from './respond'
import { createMockSession } from './session'
import { createSimulationRuns } from '../simulationRuns'

/** Задержка по умолчанию: достаточно, чтобы увидеть состояния загрузки (D-07). */
const DEFAULT_LATENCY_MS = 150

/** Сервисы на фикстурах apps/web/src/mocks/fixtures — до подключения services/api. */
export function createMockServices(options: MockOptions = { latencyMs: DEFAULT_LATENCY_MS }): Services {
  const projects = createMockProjects(options)
  return {
    catalog: createMockCatalog(options),
    compare: createMockCompare(options),
    processes: createMockProcesses(options),
    locations: createMockLocations(options),
    projects,
    simulationRuns: createSimulationRuns(projects),
    admin: createMockAdmin(options),
    session: createMockSession(options),
    dashboard: createMockDashboard(options),
  }
}
