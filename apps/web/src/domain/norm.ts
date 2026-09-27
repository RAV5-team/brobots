import type { ValueSource } from './common'

/** Группы справочника нормативов в порядке экрана А5 (PRD 6.8). */
export const NORM_GROUPS = ['staff', 'fleet', 'capex', 'opex', 'finance', 'interpretation'] as const
export type NormGroup = (typeof NORM_GROUPS)[number]

/**
 * Тип значения (PRD 6.8): норматив — из данных ФЦ БАС, ТЗ или методики;
 * допущение — значение RAV5 по умолчанию, пользователь может уточнить его в проекте.
 */
export type NormKind = 'norm' | 'assumption'

/** Расчётный норматив администратора (экран А5). */
export interface Norm {
  readonly code: string
  readonly name: string
  readonly group: NormGroup
  readonly kind: NormKind
  readonly value: number
  /** Допуск в обе стороны: значение показывается как «±20». */
  readonly symmetric?: boolean
  readonly unit: string
  /** Источник значения — как подписан на экране. */
  readonly source: string
}

/** Новое значение норматива при сохранении справочника. */
export interface NormChange {
  readonly code: string
  readonly value: number
}

/** Допущение, вошедшее в расчёт: попадает в реестр допущений отчёта. */
export interface Assumption {
  readonly subject: string
  readonly value: number | string
  readonly source: ValueSource
  readonly reason: string
}
