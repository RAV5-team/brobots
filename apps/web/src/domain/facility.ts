import type { ValueSource } from './common'

export type FacilityTypeCode = 'warehouse' | 'airport' | 'medical'

export interface FacilityType {
  readonly code: FacilityTypeCode
  readonly name: string
}

/** Параметр типа объекта из датасета организатора (PRD, приложение А). */
export interface FacilityParameter {
  /** Код параметра: wh_total_area, ap_…, med_… */
  readonly code: string
  readonly facilityType: FacilityTypeCode
  /** Группа параметров, как в датасете: «Режим работы», «Персонал». */
  readonly group: string
  readonly name: string
  readonly unit: string
  /** Базовое значение: демо-данные и значение по умолчанию. */
  readonly base: number | string
  /** Допустимый диапазон — для валидации; у текстовых параметров его нет. */
  readonly min: number | null
  readonly max: number | null
  /** Примечание организатора — подсказка и источник норматива. */
  readonly note: string
}

/** Значение параметра на конкретной локации. */
export interface ParameterValue {
  readonly value: number | string
  readonly source: ValueSource
}
