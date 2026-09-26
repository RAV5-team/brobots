import type { IsoDateTime } from './common'
import type { LocationId } from './location'
import type { LocationProcessId } from './locationProcess'

export type ProjectId = `PJ-${string}`

/** Шаг черновика: параметры → подбор → симуляция → итог и экономика (PRD 11). */
export type ProjectStep = 'params' | 'matching' | 'simulation' | 'economics'

/** Проект: черновик или сохранённая оценка (только просмотр, D-17). */
export interface Project {
  readonly id: ProjectId
  readonly name: string
  readonly locationId: LocationId
  readonly processIds: readonly LocationProcessId[]
  readonly status: 'draft' | 'saved'
  readonly step: ProjectStep
  readonly updatedAt: IsoDateTime
  /** Предварительный результат с экрана; до появления экономической модели не пересчитывается. */
  readonly preliminary: ProjectPreliminary | null
}

export interface ProjectPreliminary {
  readonly paybackYears: number
  readonly annualEffectRub: number | null
}
