import type { AcquisitionModel } from './projectInputs'

/** Экономика сценария (покупка или RaaS) выбранного решения — из результата расчёта подбора. */
export interface ScenarioEconomics {
  readonly acquisition: AcquisitionModel
  readonly robots: number
  /** null — расчёт станций не прислал. */
  readonly stations: number | null
  readonly capexRub: number
  /** Платёж RaaS за парк в месяц; у покупки — null. */
  readonly raasMonthlyRub: number | null
  /** Расходы процесса в год после внедрения: оставшийся ФОТ и новые расходы. */
  readonly opexRubPerYear: number
  readonly laborSavingsRubPerYear: number | null
  readonly annualEffectRub: number
  /** null — не окупается. */
  readonly paybackYears: number | null
  /** Доля: накопленный эффект за горизонт ÷ CAPEX; null — нет в расчёте. */
  readonly roi: number | null
  readonly tcoRub: number | null
}

/** Текущий процесс без роботов — база сравнения сценариев. */
export interface CurrentProcessEconomics {
  readonly opexRubPerYear: number
  readonly tcoRub: number | null
}

/** Строка «Устойчивость результата»: окупаемость при отклонении параметра на ±20 % (PRD 11.5). */
export interface SensitivityRow {
  readonly parameter: string
  readonly base: string
  readonly paybackYears: { readonly minus20: number; readonly plus20: number }
  readonly tcoRub: { readonly minus20: number; readonly plus20: number } | null
  readonly note: string | null
}

/** Статус условия в реестре итога (PRD 11.5). */
export type ConditionStatus = 'confirmed' | 'needs_check' | 'assumption' | 'no_data'

/** Строка реестра «Неизвестные условия и допущения» (PRD 11.5). */
export interface ConditionRow {
  readonly parameter: string
  readonly value: string
  readonly status: ConditionStatus
  readonly source: string
  readonly scenario: string
  readonly impact: string
  readonly howToConfirm: string
}

/** Итог и экономика проекта: сценарии, база, устойчивость и реестр условий. */
export interface EconomicsResult {
  readonly horizonYears: number
  /** Операций в сутки — для стоимости операции. */
  readonly operationsPerDay: number
  readonly current: CurrentProcessEconomics
  readonly scenarios: readonly ScenarioEconomics[]
  readonly sensitivity: readonly SensitivityRow[]
  readonly conditions: readonly ConditionRow[]
}

/** Накопленный денежный поток по годам 0…horizon без дисконтирования: год 0 — −CAPEX, дальше + эффект в год. */
export function cumulativeCashFlow(
  { capexRub, annualEffectRub }: Pick<ScenarioEconomics, 'capexRub' | 'annualEffectRub'>,
  horizonYears: number,
): readonly number[] {
  return Array.from({ length: horizonYears + 1 }, (_, year) => -capexRub + year * annualEffectRub)
}

const DAYS_PER_YEAR = 365

/** Стоимость одной операции, ₽: расходы процесса в год ÷ операций за год. */
export function operationCostRub(opexRubPerYear: number, operationsPerDay: number, daysPerYear = DAYS_PER_YEAR): number {
  return opexRubPerYear / (operationsPerDay * daysPerYear)
}

/** Вывод о целесообразности (PRD 11.5): не строится на пороге окупаемости. */
export type Conclusion = 'preliminary' | 'conditional' | 'not_recommended'

/** Чем закончилась проверка состава: пройдена, не запускалась, принят риск (состав не вывозит поток). */
export type SimulationOutcome = 'passed' | 'none' | 'risk_accepted'

export interface ConclusionInput {
  readonly annualEffectRub: number
  readonly uncheckedConditions: number
  readonly simulation: SimulationOutcome
}

export function conclusion({ annualEffectRub, uncheckedConditions, simulation }: ConclusionInput): Conclusion {
  if (annualEffectRub <= 0 || simulation === 'risk_accepted') return 'not_recommended'
  if (uncheckedConditions > 0 || simulation === 'none') return 'conditional'
  return 'preliminary'
}
