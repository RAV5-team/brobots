import type { OperationClass, OperationClassCode, Process } from '@/domain'

export type CountsByClass = Readonly<Partial<Record<OperationClassCode, number>>>

/** Строка таблицы А8: класс справочника и счётчики, посчитанные из каталога и библиотеки (D-13). */
export interface OperationClassRow {
  readonly code: OperationClassCode
  readonly name: string
  readonly description: string
  /** Единица класса — подсказки единиц в окне А10. */
  readonly unit: string
  /** Роботы каталога, отмеченные классом. */
  readonly robotCount: number
  /** Процессы библиотеки с этим классом; 0 — класс не попадёт в подбор (PRD 6.7). */
  readonly processCount: number
}

/** Сколько процессов библиотеки используют класс: у процесса ровно один класс (PRD 3.4). */
export function countProcessesByClass(processes: readonly Process[]): CountsByClass {
  return processes.reduce<CountsByClass>(
    (counts, process) => ({ ...counts, [process.operationClass]: (counts[process.operationClass] ?? 0) + 1 }),
    {},
  )
}

/** Строки справочника по возрастанию кода: код сквозной и не переиспользуется (PRD 6.7). */
export function buildOperationClassRows(
  classes: readonly OperationClass[],
  robotsByClass: CountsByClass,
  processesByClass: CountsByClass,
): readonly OperationClassRow[] {
  return [...classes]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
      unit: c.unit,
      robotCount: robotsByClass[c.code] ?? 0,
      processCount: processesByClass[c.code] ?? 0,
    }))
}
