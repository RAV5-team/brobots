import type { IsoDateTime } from './common'

/** Способ приобретения: покупка или роботы как услуга (PRD 11.3). */
export type AcquisitionModel = 'purchase' | 'raas'

/** Состав парка: роботы и зарядные станции. */
export interface Fleet {
  readonly robots: number
  readonly stations: number
}

/**
 * Уточнённое допущение шага 1 (панель «Уточнить допущение», PRD 11.2).
 * `fact` — фактическое значение, убирает его из допущений; `estimate` — остаётся допущением с новым числом.
 * Действует только в проекте: профиль локации и справочник не меняются.
 */
export interface AssumptionOverride {
  readonly code: string
  readonly value: number
  readonly kind: 'fact' | 'estimate'
}

/** «Параметры расчёта» подбора (PRD 11.3). Пустое поле — исходное значение. */
export interface CalcParams {
  /** ₽ в месяц на сотрудника, gross. */
  readonly staffCostRubPerMonth: number
  /** Часов в сутки. */
  readonly workHoursPerDay: number
  /** Рейсов в час у выбранного решения. */
  readonly robotTripsPerHour: number
  /** ₽ за единицу. */
  readonly robotPriceRub: number
  /** ₽ в год на парк (покупка). */
  readonly serviceCostRubPerYear: number
  /** Доля 0–1. */
  readonly utilization: number
  /** Лет, не меньше 5. */
  readonly horizonYears: number
}

/** Выбранный вариант подбора: решение × способ приобретения. */
export interface ProjectSelection {
  readonly solutionId: string
  readonly acquisition: AcquisitionModel
}

/** Этапы симуляции (PRD 11.4): что проверяем → условия → прогон → вердикт. */
export type SimulationStage = 'scope' | 'conditions' | 'run' | 'verdict'
export const SIMULATION_STAGES: readonly SimulationStage[] = ['scope', 'conditions', 'run', 'verdict']

/** Люди и погрузчики в проездах (этап 2). */
export type TrafficLevel = 'rare' | 'sometimes' | 'often' | 'very_often'

/** Условия симуляции, изменённые на этапе 2; пустое поле — из задачи или по умолчанию (PRD 11.4). */
export interface SimulationConditions {
  readonly firstShiftStartHour: number
  readonly shiftsPerDay: number
  readonly shiftHours: number
  readonly peakFactor: number
  /** Часы 0–23, отмеченные пиковыми. */
  readonly peakHours: readonly number[]
  readonly inboundPalletsPerDay: number
  readonly outboundPalletsPerDay: number
  /** Доля 0–1, которую робот не возьмёт (негабарит). */
  readonly manualShare: number
  readonly maxWaitMin: number
  /** Доля 0–1 паллет в срок. */
  readonly onTimeTarget: number
  /** Доля 0–1. */
  readonly growthReserve: number
  readonly traffic: TrafficLevel
  readonly fastMoversAtGates: boolean
  readonly repairHours: number
  /** Доля 0–1 допуска расхождения с расчётом. */
  readonly tolerance: number
  readonly fleetPolicy: 'add_only' | 'add_and_reduce'
  readonly designVolume: 'current' | 'growth'
}

export interface ParamsInputs {
  readonly assumptions: readonly AssumptionOverride[]
}

export interface MatchingInputs {
  readonly calcParams: Partial<CalcParams>
  readonly selection: ProjectSelection | null
  readonly manualSolutionIds: readonly string[]
}

export interface SimulationInputs {
  readonly stage: SimulationStage
  /** Состав для проверки (этап 1), по умолчанию — как в подборе. */
  readonly fleet: Fleet | null
  readonly conditions: Partial<SimulationConditions>
  /** Последний прогон; null — ещё не запускали. */
  readonly runId: string | null
  /** План по итогам вердикта (степперы этапа 4). */
  readonly plan: Fleet | null
  /** «Продолжить без изменений и принять риск» (вердикт «нужно докупить»). */
  readonly acceptRisk: boolean
}

export interface EconomicsInputs {
  /** Меняется только кнопкой «Выбрать этот сценарий» (PRD 11.5). */
  readonly scenario: AcquisitionModel
}

/** Что устарело после правок (D-89): подбор — пересчитать, прогон — повторить. */
export interface InputsStaleness {
  readonly matching: boolean
  readonly simulation: boolean
}

/**
 * Решения пользователя по шагам проекта. Расчёты (рейтинг, прогон, экономика) — ответы сервиса, здесь не хранятся.
 * Шаги заполняются по мере прохождения; у сохранённой оценки заполнены все, кроме, возможно, симуляции.
 */
export interface ProjectInputs {
  readonly params: ParamsInputs
  readonly matching: MatchingInputs | null
  readonly simulation: SimulationInputs | null
  readonly economics: EconomicsInputs | null
  readonly stale: InputsStaleness
  readonly updatedAt: IsoDateTime
}

/** Правка решений одного или нескольких шагов (автосохранение черновика, D-21). */
export interface ProjectInputsPatch {
  readonly params?: Partial<ParamsInputs>
  readonly matching?: Partial<MatchingInputs>
  readonly simulation?: Partial<SimulationInputs>
  readonly economics?: Partial<EconomicsInputs>
}
