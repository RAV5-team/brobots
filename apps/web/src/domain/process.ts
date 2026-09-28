import type { FacilityTypeCode } from './facility'
import type { HandlingMethodCode } from './handling'
import type { OperationClassCode, WorkCategoryCode } from './operationClass'

export type ProcessCode = `PR-${string}`

/** Способ обработки груза процесса с коэффициентом замещения труда. */
export interface ProcessHandling {
  readonly method: HandlingMethodCode
  readonly laborReplacementRatio?: number
}

/** Значения процесса по умолчанию; на локации их можно переопределить. */
/** За какой период задан объём операций: сутки или цикл (инвентаризация, PRD 9.1). */
export type VolumePeriod = 'day' | 'cycle'

/** В чём считается производительность: в час или в сутки (обходы охраны, PRD 9.1). */
export type RatePeriod = 'hour' | 'day'

export interface ProcessDefaults {
  /** Носитель — в чём лежит единица потока (D-10). */
  readonly carrier?: string
  readonly unitMassKg?: number
  /** Максимальная масса грузовой единицы, кг (PRD 10.4, «Поля процесса на локации»; шаг 1 проекта). */
  readonly maxUnitMassKg?: number
  /** Габариты грузовой единицы, мм: длина × ширина × высота. */
  readonly unitDimensionsMm?: readonly [number, number, number]
  /** Частота пересчёта, раз в месяц — у инвентаризации без неё парк не посчитать (PRD 11.2, 10.4). */
  readonly recountsPerMonth?: number
  /** Делится ли единица груза; нет груза (уборка, инвентаризация, обходы) — значения нет. */
  readonly cargoDivisible?: boolean
  /** Объём операций за период `Process.volumePeriod` (обычно — сутки). */
  readonly dailyVolume: number
  readonly workHoursPerDay: number
  /** Пиковый коэффициент процесса; на локации берётся из профиля, если там он есть (PRD 9.2). */
  readonly peakFactor?: number
  /** Типовые точки маршрута по порядку: «Приёмка», «Зона хранения», «Отгрузка» (экран 11). */
  readonly routePoints?: readonly string[]
  readonly automationShare: number
  readonly routeLengthM?: number
  readonly minOperatingTempC?: number
}

/** Процесс — шаблон в библиотеке процессов (глоссарий). */
export interface Process {
  readonly code: ProcessCode
  readonly name: string
  readonly description: string
  readonly operationClass: OperationClassCode
  /** Единица объёма в сутки: «паллет», «строк». */
  readonly volumeUnit: string
  /** По умолчанию — сутки. */
  readonly volumePeriod?: VolumePeriod
  /** Период единицы производительности («паллет / ч»); по умолчанию — час. */
  readonly ratePeriod?: RatePeriod
  readonly facilityTypes: readonly FacilityTypeCode[]
  readonly handling: readonly ProcessHandling[]
  readonly defaultWorkerRole: string | null
  readonly defaults: ProcessDefaults
  /** Остальные поля формы процесса 09а; у процессов из источника их пока нет. */
  readonly template?: ProcessTemplate
}

/** Группа исполнителей процесса: численность и оклад придут из профиля локации (PRD 9.2, секция 4). */
export interface ProcessStaffGroup {
  readonly role: string
  /** Доля времени группы на процесс, 0…1. */
  readonly timeShare: number
}

/** Поля шаблона процесса сверх значений по умолчанию (PRD 9.2). Доли — 0…1, деньги — ₽. */
export interface ProcessTemplate {
  readonly category: { readonly facilityType: FacilityTypeCode; readonly workCategory: WorkCategoryCode }
  /** «Откуда → куда · типовой маршрут». */
  readonly route: string
  readonly peakFactor: number
  readonly speedLimitMps: number
  readonly widthMarginM: number
  readonly liftTripShare: number
  readonly liftWaitS: number
  readonly indoor: boolean
  readonly minAisleWidthM: number
  readonly staff: readonly ProcessStaffGroup[]
  readonly staffTurnoverShare: number
  readonly workTimeLossShare: number
  readonly fleetOperatorsPerShift: number
  readonly fleetOperatorSalaryRub: number
  /** Подготовка объекта, доля стоимости парка. */
  readonly sitePreparationShare: number
  readonly itIntegrationRub: number
  readonly consumablesRubPerYear: number
  readonly otherEffectsRubPerYear: number
}

/** Новый процесс из формы 09а: код присваивает справочник. */
export type NewProcess = Omit<Process, 'code'>
