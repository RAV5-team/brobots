import type { ConditionRow, EconomicsResult, ScenarioEconomics, SensitivityRow } from '@/domain'
import { ContractError, optional, required, type ApiSchemas } from '../contract'
import { toMatchingEvaluation } from './matching'

/** Блоки итога, которых нет в Evaluation: устойчивость, реестр условий, объём операций процесса. */
export interface EconomicsExtras {
  readonly sensitivity: readonly SensitivityRow[]
  readonly conditions: readonly ConditionRow[]
  readonly operationsPerDay: number
}

/**
 * Итог и экономика из расчёта подбора (в API отдельного эндпоинта нет, вопрос — docs/api-contract.md):
 * сценарии «покупка» и RaaS выбранного решения, база — текущий процесс из `details`.
 */
export function toEconomics(dto: ApiSchemas['Evaluation'], solutionId: string, extras: EconomicsExtras): EconomicsResult {
  const evaluation = toMatchingEvaluation(dto)
  const scenarios: ScenarioEconomics[] = evaluation.variants
    .filter((v) => v.solutionId === solutionId)
    .map((v) => ({
      acquisition: v.acquisition,
      robots: v.robots,
      stations: v.stations,
      capexRub: v.capexRub,
      raasMonthlyRub: v.raasMonthlyRub,
      opexRubPerYear: v.opexRubPerYear,
      laborSavingsRubPerYear: v.laborSavingsRubPerYear,
      annualEffectRub: v.annualEffectRub,
      paybackYears: v.paybackYears,
      roi: v.roi,
      tcoRub: v.tcoRub,
    }))
  if (scenarios.length === 0) throw new ContractError(`Evaluation: в расчёте нет решения ${solutionId}`)

  const details = dto.candidates
    ?.flatMap((c) => c.results ?? [])
    .find((r) => r.solutionId === solutionId)?.details
  const baseline = required(details ?? {}, 'baselineOpexYearRub', 'CalcResult.details')
  return {
    horizonYears: evaluation.horizonYears,
    operationsPerDay: extras.operationsPerDay,
    current: { opexRubPerYear: baseline, tcoRub: optional(details?.baselineTcoRub) },
    scenarios,
    sensitivity: extras.sensitivity,
    conditions: extras.conditions,
  }
}
