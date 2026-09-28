import type {
  AcquisitionModel,
  CalcParams,
  CostItem,
  ExcludedSolution,
  MatchBaseline,
  MatchCondition,
  MatchingEvaluation,
  RankedVariant,
  ScoreContribution,
  SolutionCheck,
  VariantStatus,
} from '@/domain'
import { oneOf, optional, required, type ApiSchemas } from '../contract'

type EvaluatedCandidate = ApiSchemas['EvaluatedCandidate']
type CalcResult = ApiSchemas['CalcResult']

const ACQUISITIONS: readonly AcquisitionModel[] = ['purchase', 'raas']
const MONTHS = 12
/** Статья OPEX с годовым платежом RaaS (services/api, calc/economics/labels.go). */
const RAAS_FEE_ITEM = 'opex.annual_raas_cost'
const PERCENT = 100

function toCondition(dto: ApiSchemas['Condition']): MatchCondition {
  const entity = 'Condition'
  return {
    code: required(dto, 'code', entity),
    label: required(dto, 'label', entity),
    number: optional(dto.number),
    unit: optional(dto.unit),
    text: optional(dto.text),
    list: dto.list ?? [],
    source: oneOf(required(dto, 'source', entity), ['task', 'formula', 'project', 'rule'], `${entity}.source`),
    note: optional(dto.note),
    applicable: dto.applicable ?? true,
  }
}

function toCheck(dto: ApiSchemas['Check']): SolutionCheck {
  return {
    code: required(dto, 'code', 'Check'),
    label: required(dto, 'label', 'Check'),
    status: oneOf(required(dto, 'status', 'Check'), ['pass', 'fail', 'unknown', 'not_applicable'], 'Check.status'),
    message: optional(dto.message),
  }
}

function toCriterion(dto: ApiSchemas['ScoreCriterion']): ScoreContribution {
  return {
    code: required(dto, 'code', 'ScoreCriterion'),
    label: required(dto, 'label', 'ScoreCriterion'),
    weight: required(dto, 'weight', 'ScoreCriterion') / PERCENT,
    contribution: optional(dto.contribution),
  }
}

function toCostItem(dto: ApiSchemas['CostItem']): CostItem {
  return {
    code: required(dto, 'code', 'CostItem'),
    label: required(dto, 'label', 'CostItem'),
    amountRub: required(dto, 'amountRub', 'CostItem'),
  }
}

function raasMonthly(dto: CalcResult, acquisition: AcquisitionModel): number | null {
  if (acquisition !== 'raas') return null
  const fee = dto.details?.opexItems?.find((item) => item.code === RAAS_FEE_ITEM)?.amountRub
  return fee == null ? null : fee / MONTHS
}

function toVariant(candidate: EvaluatedCandidate, dto: CalcResult, status: VariantStatus): RankedVariant {
  const entity = `CalcResult ${dto.id ?? ''}`.trim()
  const solution = required(required(candidate, 'match', 'EvaluatedCandidate'), 'solution', 'Candidate')
  const acquisition = oneOf(required(dto, 'acquisitionModel', entity), ACQUISITIONS, `${entity}.acquisitionModel`)
  return {
    solutionId: required(dto, 'solutionId', entity),
    solutionName: required(solution, 'name', 'CandidateSolution'),
    manufacturer: solution.manufacturer ?? '',
    acquisition,
    rank: optional(dto.rank),
    score: optional(dto.score),
    status,
    robots: required(dto, 'robotCount', entity),
    stations: optional(dto.chargerCount),
    capexRub: required(dto, 'capexRub', entity),
    raasMonthlyRub: raasMonthly(dto, acquisition),
    opexRubPerYear: required(dto, 'opexYearRub', entity),
    annualEffectRub: required(dto, 'netEffectYearRub', entity),
    laborSavingsRubPerYear: optional(dto.laborSavingsYearRub),
    paybackYears: optional(dto.paybackYears),
    roi: optional(dto.roi),
    tcoRub: optional(dto.tcoRub),
    criteria: (dto.details?.scoreCriteria ?? []).map(toCriterion),
    cycleTimeS: optional(dto.details?.cycleTimeS),
    fleetUtilization: optional(dto.details?.fleetUtilization),
    capexItems: (dto.details?.capexItems ?? []).map(toCostItem),
    opexItems: (dto.details?.opexItems ?? []).map(toCostItem),
    warnings: dto.warnings ?? [],
    checks: (candidate.match?.checks ?? []).map(toCheck),
  }
}

function toExcluded(candidate: EvaluatedCandidate): ExcludedSolution {
  const solution = required(required(candidate, 'match', 'EvaluatedCandidate'), 'solution', 'Candidate')
  return {
    solutionId: required(solution, 'id', 'CandidateSolution'),
    solutionName: required(solution, 'name', 'CandidateSolution'),
    manufacturer: solution.manufacturer ?? '',
    reasons: (candidate.match?.checks ?? []).map(toCheck).filter((check) => check.status === 'fail'),
  }
}

/** Решение прошло проверки, но модель его не посчитала: причина расчёта — строкой проверки. */
function toNotCalculated(candidate: EvaluatedCandidate): ExcludedSolution {
  const excluded = toExcluded(candidate)
  const reason = (candidate.results ?? []).map((r) => r.reason).find((r): r is string => Boolean(r)) ?? null
  return { ...excluded, reasons: [...excluded.reasons, { code: 'calculation', label: 'Расчёт', status: 'fail', message: reason }] }
}

/** База сравнения — у всех результатов одна (текущий процесс); берём первую, где она есть. */
function toBaseline(results: readonly CalcResult[]): MatchBaseline | null {
  const details = results.map((r) => r.details).find((d) => d?.baselineOpexYearRub != null)
  if (details?.baselineOpexYearRub == null) return null
  return { opexRubPerYear: details.baselineOpexYearRub, tcoRub: optional(details.baselineTcoRub) }
}

const byRank = (a: RankedVariant, b: RankedVariant): number => (a.rank ?? Infinity) - (b.rank ?? Infinity)

/**
 * Расчёт подбора API (Evaluation) → подбор экрана: рейтинг вариантов, исключённые, условия.
 * Исходных «Параметров расчёта» в Evaluation нет (api-contract.md, №11) — их передаёт вызывающий.
 */
export function toMatchingEvaluation(dto: ApiSchemas['Evaluation'], calcDefaults: CalcParams | null = null): MatchingEvaluation {
  const entity = 'Evaluation'
  const candidates = required(dto, 'candidates', entity)
  const state = (c: EvaluatedCandidate) =>
    oneOf(required(required(c, 'match', 'EvaluatedCandidate'), 'state', 'Candidate'), ['passed', 'needs_verification', 'excluded'], 'Candidate.state')

  // «Не рассчитано» (calculable: false) — без парка и цифр: в рейтинг не идёт, решение показывается с причиной.
  const calculable = (c: EvaluatedCandidate) => (c.results ?? []).filter((r) => r.calculable !== false)
  const assessed = candidates.filter((c) => state(c) !== 'excluded')
  const variants = assessed
    .flatMap((c) => {
      const status: VariantStatus = c.match?.isManual ? 'manual' : (state(c) as Exclude<VariantStatus, 'manual'>)
      return calculable(c).map((r) => toVariant(c, r, status))
    })
    .sort(byRank)
  const notCalculated = assessed.filter((c) => calculable(c).length === 0 && (c.results ?? []).length > 0).map(toNotCalculated)

  const recommendedId = optional(dto.recommendedResultId)
  const recommended = candidates.flatMap((c) => c.results ?? []).find((r) => r.id === recommendedId)
  const counts = required(dto, 'counts', entity)
  const count = (key: keyof ApiSchemas['MatchCounts']) => required(counts, key, `${entity}.counts`)

  return {
    id: required(dto, 'id', entity),
    stale: dto.stale ?? false,
    conditions: required(dto, 'conditions', entity).map(toCondition),
    variants,
    excluded: [...candidates.filter((c) => state(c) === 'excluded').map(toExcluded), ...notCalculated],
    counts: { total: count('total'), passed: count('passed'), needsVerification: count('needsVerification'), excluded: count('excluded'), manual: count('manual') },
    recommended: recommended
      ? { solutionId: required(recommended, 'solutionId', 'CalcResult'), acquisition: oneOf(required(recommended, 'acquisitionModel', 'CalcResult'), ACQUISITIONS, 'CalcResult.acquisitionModel') }
      : null,
    horizonYears: required(dto, 'horizonYears', entity),
    modelVersion: required(dto, 'modelVersion', entity),
    baseline: toBaseline(candidates.flatMap((c) => c.results ?? [])),
    calcDefaults,
  }
}
