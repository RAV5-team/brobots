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
  /**
   * Секция профиля. У условий площадки — группа подбора (`aisles`, `floor`, `layout`, `operating`, `connectivity`),
   * у остальных параметров датасета — `area`, `schedule`, `staff`, `object_params`.
   */
  readonly formSection?: string
  /** Варианты списка. Пусто — свободный ввод. */
  readonly enumValues?: readonly string[]
  /** На шаге проекта строка есть только у процесса с маршрутом. */
  readonly routeOnly?: boolean
  /** Пустое значение помечает подбор «требует проверки». */
  readonly checkedByMatching?: boolean
  /** Второе значение той же строки шага 1, например температура «до». */
  readonly pairCode?: string | null
  /** Порядок в справочнике типа объекта. */
  readonly sort?: number
  readonly valueType?: string
}

/** Значение параметра на конкретной локации. */
export interface ParameterValue {
  readonly value: number | string
  readonly source: ValueSource
}
