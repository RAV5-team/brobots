import { isSameRobot, nextOperationClassCode, nextRobotId, type OperationClass, type OperationClassCode, type Robot } from '@/domain'
import { HANDLING_METHODS, OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { ROBOTS } from '@/mocks/fixtures/robots'
import type { CatalogService } from '../catalog'
import { ValidationError } from '../errors'
import { findOrReject, respond, type MockOptions } from './respond'

export function createMockCatalog(options: MockOptions): CatalogService {
  // Созданные классы и роботы живут до перезагрузки страницы: фикстуры не меняются.
  let classes: readonly OperationClass[] = OPERATION_CLASSES
  let robots: readonly Robot[] = ROBOTS
  return {
    listRobots: (filter = {}) => {
      const { operationClass } = filter
      const found = operationClass === undefined
        ? robots
        : robots.filter((r) => r.operationClasses.some((c) => c.code === operationClass))
      return respond(found, options)
    },
    getRobot: (id) => findOrReject(robots, (r) => r.id === id, `Робот ${id} не найден`, options),
    createRobot: (input) => {
      const twin = robots.find((r) => isSameRobot(r, input))
      if (twin) return Promise.reject(new ValidationError(`Решение уже есть в каталоге: ${twin.id}`))
      const created: Robot = {
        ...input,
        id: nextRobotId(robots.map((r) => r.id)),
        alternativePricesRub: [],
        industries: [],
        scenarios: [],
        description: '',
        // Внесён администратором вручную — метки «требует подтверждения» нет (PRD 6.1).
        needsConfirmation: false,
        updatedAt: new Date().toISOString(),
        testedByFcbas: false,
        inRegistry719: false,
      }
      robots = [...robots, created]
      return respond(created, options)
    },
    listOperationClasses: () => respond(classes, options),
    createOperationClass: (input) => {
      const created: OperationClass = { ...input, code: nextOperationClassCode(classes.map((c) => c.code)) }
      classes = [...classes, created]
      return respond(created, options)
    },
    countRobotsByClass: () => {
      const counts = Object.fromEntries(
        classes.map((c) => [c.code, robots.filter((r) => r.operationClasses.some((rc) => rc.code === c.code)).length]),
      ) as Record<OperationClassCode, number>
      return respond(counts, options)
    },
    listHandlingMethods: () => respond(HANDLING_METHODS, options),
  }
}
