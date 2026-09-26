import { DATA_SOURCES } from '@/mocks/fixtures/dataSources'
import type { AdminService } from '../admin'
import { respond, type MockOptions } from './respond'

export function createMockAdmin(options: MockOptions): AdminService {
  return {
    listDataSources: () => respond(DATA_SOURCES, options),
  }
}
