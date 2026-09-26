import type { ValueSource } from './common'

/** Расчётный норматив администратора (экран А5). */
export interface Norm {
  readonly code: string
  readonly name: string
  readonly value: number
  readonly unit: string
  readonly source: string
}

/** Допущение, вошедшее в расчёт: попадает в реестр допущений отчёта. */
export interface Assumption {
  readonly subject: string
  readonly value: number | string
  readonly source: ValueSource
  readonly reason: string
}
