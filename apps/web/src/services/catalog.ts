import type { HandlingMethod, LaunchItem, NewOperationClass, NewRobot, OperationClass, OperationClassCode, Robot, RobotId } from '@/domain'

export interface RobotFilter {
  readonly operationClass?: OperationClassCode
}

/** Каталог роботов и справочники подбора (PRD 6, 7). */
export interface CatalogService {
  listRobots(filter?: RobotFilter): Promise<readonly Robot[]>
  getRobot(id: RobotId): Promise<Robot>
  /**
   * Добавить робота вручную (карточка А2); вернёт его с присвоенным идентификатором RB-NNNN.
   * Робот с тем же названием и производителем уже есть — ValidationError (PRD 6.1: вторую строку не создаём).
   */
  createRobot(input: NewRobot): Promise<Robot>
  /** Позиции для запуска: инфраструктура, ПО, услуги и поддержка (PRD 7.5). */
  listLaunchItems(): Promise<readonly LaunchItem[]>
  listOperationClasses(): Promise<readonly OperationClass[]>
  /** Добавить класс в справочник (экран А10); вернёт класс с присвоенным кодом OP-NN. */
  createOperationClass(input: NewOperationClass): Promise<OperationClass>
  /** Число роботов по классу операции — считается из каталога, а не хранится (D-13). */
  countRobotsByClass(): Promise<Readonly<Record<OperationClassCode, number>>>
  listHandlingMethods(): Promise<readonly HandlingMethod[]>
}
