import type { OperationClassCode } from '@/domain'
import { HANDLING_METHODS, OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { ROBOTS } from '@/mocks/fixtures/robots'
import type { CatalogService } from '../catalog'
import { findOrReject, respond, type MockOptions } from './respond'

export function createMockCatalog(options: MockOptions): CatalogService {
  return {
    listRobots: (filter = {}) => {
      const { operationClass } = filter
      const robots = operationClass === undefined
        ? ROBOTS
        : ROBOTS.filter((r) => r.operationClasses.some((c) => c.code === operationClass))
      return respond(robots, options)
    },
    getRobot: (id) => findOrReject(ROBOTS, (r) => r.id === id, `Робот ${id} не найден`, options),
    listOperationClasses: () => respond(OPERATION_CLASSES, options),
    countRobotsByClass: () => {
      const counts = Object.fromEntries(
        OPERATION_CLASSES.map((c) => [c.code, ROBOTS.filter((r) => r.operationClasses.some((rc) => rc.code === c.code)).length]),
      ) as Record<OperationClassCode, number>
      return respond(counts, options)
    },
    listHandlingMethods: () => respond(HANDLING_METHODS, options),
  }
}
