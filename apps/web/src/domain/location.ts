import type { FacilityTypeCode, ParameterValue } from './facility'

export type LocationId = `LOC-${string}`

/** Локация: тип объекта и параметры площадки (глоссарий). */
export interface Location {
  readonly id: LocationId
  readonly name: string
  readonly facilityType: FacilityTypeCode
  readonly city: string
  readonly address: string
  readonly capexBudgetRub: number
  readonly horizonYears: number
  /** Значения параметров по кодам (wh_total_area…). Отсутствующие берутся из базы датасета. */
  readonly parameters: Readonly<Record<string, ParameterValue>>
  readonly staffGroups: readonly StaffGroup[]
}

export interface StaffGroup {
  readonly role: string
  readonly headcount: number
  /** Оклад брутто в месяц, ₽; null — в данных нет. */
  readonly salaryGrossMonthRub: number | null
}
