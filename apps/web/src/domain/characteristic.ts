/** Статус значения характеристики (ТЗ 3.3.4, PRD 7.7): подтверждено, оценка, нет данных (D-76). */
export type CharacteristicStatus = 'confirmed' | 'estimate' | 'missing'

export const CHARACTERISTIC_STATUSES: readonly CharacteristicStatus[] = ['confirmed', 'estimate', 'missing']

/**
 * Характеристика позиции каталога: готовое значение для показа, статус, источник и дата (D-76).
 * `missing` — значения нет (`value: null`), в `source` — что с этим делать («требует уточнения у поставщика»).
 */
export interface Characteristic {
  readonly value: string | null
  readonly status: CharacteristicStatus
  readonly source: string
  /** Дата значения у источника, `YYYY-MM-DD`: «морос.рф · 19.09.2026». */
  readonly date?: string
}

export type CharacteristicCounts = Readonly<Record<CharacteristicStatus, number>>

/** «17 подтверждено · 10 оценка · 3 нет данных» — считается, а не хранится (D-77). */
export function countByStatus(items: readonly Pick<Characteristic, 'status'>[]): CharacteristicCounts {
  return {
    confirmed: items.filter((c) => c.status === 'confirmed').length,
    estimate: items.filter((c) => c.status === 'estimate').length,
    missing: items.filter((c) => c.status === 'missing').length,
  }
}

/** «Полнота 27 из 30 полей»: заполнено — всё, что не `missing` (D-77). */
export function completeness(items: readonly Pick<Characteristic, 'status'>[]): { readonly filled: number; readonly total: number } {
  return { filled: items.filter((c) => c.status !== 'missing').length, total: items.length }
}
