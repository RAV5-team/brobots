import { deriveLaunchRequired, isSameRobot, nextOperationClassCode, nextRobotId, type OperationClass, type OperationClassCode, type Robot } from '@/domain'
import { LAUNCH_ITEMS } from '@/mocks/fixtures/launchItems'
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
      if (twin) return Promise.reject(new ValidationError({ kind: 'robotDuplicate', robotId: twin.id }, `Решение уже есть в каталоге: ${twin.id}`))
      const id = nextRobotId(robots.map((r) => r.id))
      const created: Robot = {
        ...input,
        id,
        alternativePricesRub: [],
        industries: [],
        scenarios: [],
        description: '',
        // Внесён администратором вручную — метки «требует подтверждения» нет (PRD 6.1).
        needsConfirmation: false,
        updatedAt: new Date().toISOString(),
        testedByFcbas: false,
        inRegistry719: false,
        // Новый робот ещё не указан в совместимости позиций — по правилу D-63 остаётся «внедрение».
        launchRequired: deriveLaunchRequired(id, LAUNCH_ITEMS),
        // Позиции «в зависимости от объекта» для нового робота не выводятся из данных (D-78).
        launchConditional: [],
      }
      robots = [...robots, created]
      return respond(created, options)
    },
    listLaunchItems: (types) => respond(types === undefined ? LAUNCH_ITEMS : LAUNCH_ITEMS.filter((item) => types.includes(item.type)), options),
    listOperationClasses: () => respond(classes, options),
    createOperationClass: (input) => {
      const created: OperationClass = { ...input, code: nextOperationClassCode(classes.map((c) => c.code)) }
      classes = [...classes, created]
      return respond(created, options)
    },
    countRobotsByClass: () => {
      const counts: Readonly<Record<OperationClassCode, number>> = Object.fromEntries(
        classes.map((c) => [c.code, robots.filter((r) => r.operationClasses.some((rc) => rc.code === c.code)).length]),
      )
      return respond(counts, options)
    },
    listHandlingMethods: () => respond(HANDLING_METHODS, options),
  }
}
