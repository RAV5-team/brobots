import type { IsoDateTime } from './common'
import type { FacilityTypeCode, ParameterValue } from './facility'

/** В API — UUID, в фикстурах — LOC-NN. */
export type LocationId = string

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
  /** Когда профиль менялся последний раз — «обновлено 14.09.2026», сортировка списка (PRD 10.1). */
  readonly updatedAt: IsoDateTime
}

/** Новая локация из формы 14: идентификатор и дату изменения присваивает сервис (`POST /locations`). */
export type NewLocation = Omit<Location, 'id' | 'updatedAt'>

export interface StaffGroup {
  readonly role: string
  readonly headcount: number
  /** Оклад брутто в месяц, ₽; null — в данных нет. */
  readonly salaryGrossMonthRub: number | null
}

/**
 * Сводка для карточки списка локаций (PRD 10.1) — как `summary` у `GET /locations` (services/api, domain.LocationSummary).
 * null — значения нет в профиле или его пока не посчитать.
 */
export interface LocationSummary {
  readonly locationId: LocationId
  readonly totalAreaM2: number | null
  readonly staffTotal: number | null
  readonly shiftsPerDay: number | null
  readonly shiftHours: number | null
  readonly processesCount: number
  /** Затраты на персонал в процессах локации, ₽/год — база сравнения для проектов. */
  readonly laborCostRubYear: number | null
  /** Сколько человек занято в операционных процессах. */
  readonly workersInProcesses: number | null
  /** Полнота профиля, 0–100. */
  readonly parametersCompletenessPct: number
  /** Сколько значений профиля приняты допущением, а не данными. */
  readonly assumptionsCount: number
  readonly projectsCount: number
  readonly projectsCompleted: number
}
