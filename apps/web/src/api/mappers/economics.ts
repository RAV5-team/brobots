import type { ConditionRow, EconomicsResult, ScenarioEconomics } from '@/domain'
import { ContractError, optional, required, type ApiSchemas } from '../contract'
import { toMatchingEvaluation } from './matching'

/** Блоки итога, которых нет в Evaluation: реестр условий и объём операций процесса. */
export interface EconomicsExtras {
  readonly conditions: readonly ConditionRow[]
  readonly operationsPerDay: number
  /** База, если расчёт её не прислал (мок-модель api): ФОТ исполнителей задачи из снимка. */
  readonly baselineOpexRubPerYear?: number | null
}

/**
 * Итог и экономика из расчёта подбора (в API отдельного эндпоинта нет, вопрос — docs/api-contract.md):
 * сценарии «покупка» и RaaS выбранного решения, база — текущий процесс из `details`.
 */
export function toEconomics(dto: ApiSchemas['Evaluation'], solutionId: string, extras: EconomicsExtras): EconomicsResult {
  const evaluation = toMatchingEvaluation(dto)
  const variants = evaluation.variants.filter((v) => v.solutionId === solutionId)
  const scenarios: ScenarioEconomics[] = variants
    .map((v) => ({
      acquisition: v.acquisition,
      rank: v.rank,
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
      capexItems: v.capexItems,
      opexItems: v.opexItems,
    }))
  const first = variants[0]
  if (!first) throw new ContractError(`Evaluation: в расчёте нет решения ${solutionId}`)

  const details = dto.candidates
    ?.flatMap((c) => c.results ?? [])
    .find((r) => r.solutionId === solutionId)?.details
  const baseline = details?.baselineOpexYearRub ?? extras.baselineOpexRubPerYear
    ?? required(details ?? {}, 'baselineOpexYearRub', 'CalcResult.details')
  const recommended = evaluation.recommended
  return {
    solutionId,
    solutionName: first.solutionName,
    manufacturer: first.manufacturer,
    horizonYears: evaluation.horizonYears,
    rankedTotal: evaluation.variants.filter((v) => v.rank !== null).length,
    recommended: recommended?.solutionId === solutionId ? recommended.acquisition : null,
    operationsPerDay: extras.operationsPerDay,
    current: { opexRubPerYear: baseline, tcoRub: optional(details?.baselineTcoRub) },
    scenarios,
    conditions: extras.conditions,
  }
}
