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
  /** Есть у классов из справочника источника; в форме А10 такого поля нет (PRD 6.7, D-45). */
  readonly workCategory?: WorkCategoryCode
  readonly typicalCarriers: readonly string[]
  readonly exampleProcesses: readonly string[]
}

/** Поля формы А10: код присваивает система (PRD 6.7). */
export type NewOperationClass = Omit<OperationClass, 'code' | 'workCategory'>

export type WorkCategoryCode =
  | 'internal_logistics'
  | 'fulfillment'
  | 'facility_maintenance'
  | 'accounting_control'
  | 'security'

const CODE_PATTERN = /^OP-(\d+)$/
const CODE_DIGITS = 2

/** Следующий свободный код OP-NN: максимум плюс один — код не переиспользуется (PRD 6.7). */
export function nextOperationClassCode(codes: readonly OperationClassCode[]): OperationClassCode {
  const max = codes.reduce((acc, code) => Math.max(acc, Number(CODE_PATTERN.exec(code)?.[1] ?? 0)), 0)
  return `OP-${String(max + 1).padStart(CODE_DIGITS, '0')}`
}
