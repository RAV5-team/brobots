import type { Norm } from './norm'

/**
 * Нормативы А5, от которых зависят расчёты и подписи экранов (PRD 6.8). Правка норматива в справочнике
 * пересчитывает экраны; запасные значения — пока справочник не загрузился или норматива в нём нет.
 */
export interface ModelNorms {
  /** Начисления на ФОТ: `payroll_tax_ratio`, коэффициент (1,302). */
  readonly payrollTaxRatio: number
  /** Шаг чувствительности: `sensitivity_step_pct`, доля (0,2 — «±20 %»). */
  readonly sensitivityShift: number
  /** Допуск расхождения симуляции и расчёта: `simulation_tolerance_pct`, доля (0,1 — «±10 %»). */
  readonly simulationTolerance: number
  /** Горизонт расчёта по умолчанию — он же нижняя граница поля: `horizon_years`, лет. */
  readonly horizonYears: number
  /** Запас по ширине прохода с двух сторон робота: `width_margin_m`, м (ширина робота + запас ≤ проход). */
  readonly widthMarginM: number
}

/** Значения справочника А5 на дату PRD 0.9 (`mocks/fixtures/norms.ts`). */
export const DEFAULT_MODEL_NORMS: ModelNorms = {
  payrollTaxRatio: 1.302,
  sensitivityShift: 0.2,
  simulationTolerance: 0.1,
  horizonYears: 5,
  widthMarginM: 0.6,
}

const PERCENT = 100

/** Нормативы расчёта из справочника А5; нет норматива — запасное значение. */
export function modelNormsFrom(norms: readonly Norm[]): ModelNorms {
  const value = (code: string): number | undefined => norms.find((n) => n.code === code)?.value
  const share = (code: string): number | undefined => {
    const pct = value(code)
    return pct === undefined ? undefined : pct / PERCENT
  }
  return {
    payrollTaxRatio: value('payroll_tax_ratio') ?? DEFAULT_MODEL_NORMS.payrollTaxRatio,
    sensitivityShift: share('sensitivity_step_pct') ?? DEFAULT_MODEL_NORMS.sensitivityShift,
    simulationTolerance: share('simulation_tolerance_pct') ?? DEFAULT_MODEL_NORMS.simulationTolerance,
    horizonYears: value('horizon_years') ?? DEFAULT_MODEL_NORMS.horizonYears,
    widthMarginM: value('width_margin_m') ?? DEFAULT_MODEL_NORMS.widthMarginM,
  }
}
