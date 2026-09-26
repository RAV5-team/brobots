import type { HandlingMethod, OperationClass, OperationClassCode, Robot, RobotId } from '@/domain'

export interface RobotFilter {
  readonly operationClass?: OperationClassCode
}

/** Каталог роботов и справочники подбора (PRD 6, 7). */
export interface CatalogService {
  listRobots(filter?: RobotFilter): Promise<readonly Robot[]>
  getRobot(id: RobotId): Promise<Robot>
  listOperationClasses(): Promise<readonly OperationClass[]>
  /** Число роботов по классу операции — считается из каталога, а не хранится (D-13). */
  countRobotsByClass(): Promise<Readonly<Record<OperationClassCode, number>>>
  listHandlingMethods(): Promise<readonly HandlingMethod[]>
}
