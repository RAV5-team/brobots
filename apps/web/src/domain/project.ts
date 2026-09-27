import type { IsoDateTime } from './common'
import type { LocationId } from './location'
import type { LocationProcessId } from './locationProcess'

export type ProjectId = `PJ-${string}`

/** Шаг черновика: параметры → подбор → симуляция → итог и экономика (PRD 11). */
export type ProjectStep = 'params' | 'matching' | 'simulation' | 'economics'

interface ProjectBase {
  readonly id: ProjectId
  readonly name: string
  readonly locationId: LocationId
  readonly processIds: readonly LocationProcessId[]
  readonly updatedAt: IsoDateTime
}

/** Черновик: всё можно менять, открывается на шаге, где остановились (PRD 11.1). Цифр результата нет. */
export interface DraftProject extends ProjectBase {
  readonly status: 'draft'
  readonly step: ProjectStep
}

/** Сохранённая оценка: только просмотр (D-17), цифры — из снимка и не пересчитываются. */
export interface SavedProject extends ProjectBase {
  readonly status: 'saved'
  readonly savedAt: IsoDateTime
  readonly result: ProjectResultSnapshot
}

/** Проект: черновик или сохранённая оценка. */
export type Project = DraftProject | SavedProject

/**
 * Снимок результата выбранного сценария на момент сохранения (ТЗ 3.1.5, 3.7.2):
 * те же числа показывают список A1, итог 4.x, отчёт и выгрузка.
 */
export interface ProjectResultSnapshot {
  readonly capexRub: number
  readonly opexRubPerYear: number
  readonly paybackYears: number
  /** Чистый годовой эффект; null — в источниках нет (нужен дашборду для «Найденной экономии», PRD 8.2). */
  readonly annualEffectRub: number | null
}
