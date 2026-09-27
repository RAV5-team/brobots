/** Код класса операции: OP-01 … OP-10 (PRD 3.4, 6.7). */
export type OperationClassCode = `OP-${string}`

/** Класс операции — ключ подбора: у процесса один, у робота один или несколько (D-09). */
export interface OperationClass {
  readonly code: OperationClassCode
  readonly name: string
  /** «Что делает процесс». */
  readonly description: string
  /** Единица объёма: «ед. груза», «строк», «м²». */
  readonly unit: string
  readonly workCategory: WorkCategoryCode
  readonly typicalCarriers: readonly string[]
  readonly exampleProcesses: readonly string[]
}

export type WorkCategoryCode =
  | 'internal_logistics'
  | 'fulfillment'
  | 'facility_maintenance'
  | 'accounting_control'
  | 'security'
