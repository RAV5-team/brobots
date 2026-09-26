import { DASHBOARD_INPUTS } from '@/mocks/fixtures/dashboard'
import type { DashboardService } from '../dashboard'
import { respond, type MockOptions } from './respond'

export function createMockDashboard(options: MockOptions): DashboardService {
  return {
    getInputs: () => respond(DASHBOARD_INPUTS, options),
  }
}
