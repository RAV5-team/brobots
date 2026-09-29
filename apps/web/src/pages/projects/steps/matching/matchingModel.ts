import type {
  AcquisitionModel,
  CalcParams,
  ExcludedSolution,
  MatchCondition,
  MatchingEvaluation,
  ProjectSelection,
  RankedVariant,
  Robot,
  ScoreContribution,
} from '@/domain'
import { formatNumber, parseDecimal, roundHalfUp } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.matching

const MILLION = 1_000_000

export type AcquisitionFilter = 'all' | AcquisitionModel
export type RankingSort = 'score' | 'payback' | 'effect' | 'capex'

export interface RankingQuery {
  readonly filter: AcquisitionFilter
  readonly sort: RankingSort
}

/** Вариант — пара «решение × способ приобретения»: ключ строки, выбора и сравнения. */
export const variantKey = (v: Pick<RankedVariant, 'solutionId' | 'acquisition'>): string => `${v.solutionId}:${v.acquisition}`

export const isSelected = (v: RankedVariant, selection: ProjectSelection | null): boolean =>
  selection !== null && selection.solutionId === v.solutionId && selection.acquisition === v.acquisition

/** null — в конец при любом направлении сортировки. */
function byNumber(pick: (v: RankedVariant) => number | null, direction: 1 | -1) {
  return (a: RankedVariant, b: RankedVariant): number => {
    const x = pick(a)
    const y = pick(b)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return (x - y) * direction
  }
}

const SORTS: Record<RankingSort, (a: RankedVariant, b: RankedVariant) => number> = {
  score: byNumber((v) => v.score, -1),
  payback: byNumber((v) => v.paybackYears, 1),
  capex: byNumber((v) => v.capexRub, 1),
  effect: byNumber((v) => v.annualEffectRub, -1),
}

/** Строки рейтинга 2.1 (PRD 11.3): только варианты с местом — добавленные вручную идут в конце, вне рейтинга. */
export function rankingRows(variants: readonly RankedVariant[], { filter, sort }: RankingQuery): readonly RankedVariant[] {
  return variants
    .filter((v) => v.status !== 'manual' && v.rank !== null)
    .filter((v) => filter === 'all' || v.acquisition === filter)
    .toSorted(SORTS[sort])
}

export const formatScore = (score: number): string => formatNumber(score, 2, { fixed: true })

/** Суммы подбора всегда в миллионах, как в макете: «6,1 млн ₽», платёж RaaS — «0,83 млн ₽» (16742:40, 16828:54). */
export const rubMillions = (value: number | null, digits = 1): string =>
  value === null ? '—' : t.millions(formatNumber(value / MILLION, digits, { fixed: true }))

/** Главные слагаемые балла по убыванию вклада, без пустых (отчёт 09, `VariantsSection`). */
export function topContributions(criteria: readonly ScoreContribution[], count = 3): readonly ScoreContribution[] {
  return criteria
    .filter((c): c is ScoreContribution & { readonly contribution: number } => c.contribution !== null && c.contribution > 0)
    .toSorted((a, b) => b.contribution - a.contribution)
    .slice(0, count)
}

/** «окупаемость 0,30 + ROI 0,15 + …»; вклад только у критериев с данными (отчёт 09). */
export function contributionsText(criteria: readonly ScoreContribution[]): string {
  return criteria
    .filter((c) => c.contribution !== null)
    .map((c) => `${inline(c.label)} ${formatScore(c.contribution ?? 0)}`)
    .join(' + ')
}

/** Порядок строк разбора на макете 2.1 (16828:86): CAPEX к бюджету — перед TCO; неизвестные критерии — в конце. */
const BREAKDOWN_ORDER: readonly string[] = ['payback', 'roi', 'budget_fit', 'tco_savings', 'maturity', 'annual_effect', 'fleet_utilization', 'data_quality']
const orderOf = (code: string): number => {
  const index = BREAKDOWN_ORDER.indexOf(code)
  return index === -1 ? BREAKDOWN_ORDER.length : index
}

/** Разбор балла строки рейтинга в порядке макета. */
export const breakdownOf = (v: RankedVariant): readonly ScoreContribution[] => v.criteria.toSorted((a, b) => orderOf(a.code) - orderOf(b.code))

/** Полоса разбора: вклад как доля веса критерия (полная полоса — вклад равен весу), 0–100. */
export const barPercent = (c: ScoreContribution): number =>
  c.contribution === null || c.weight <= 0 ? 0 : Math.min(100, (c.contribution / c.weight) * 100)

/** Значение условия отбора: «≥ 800 кг», «вилы / платформа», «OP-01 · Перемещение грузов». */
export function conditionValue(condition: MatchCondition): string {
  if (condition.text !== null) return condition.text
  if (condition.list.length > 0) return condition.list.join(' / ')
  if (condition.number === null) return ''
  const comparator = t.conditions.comparators[condition.code]
  const value = [formatNumber(condition.number, 2), condition.unit].filter(Boolean).join(' ')
  return comparator ? `${comparator} ${value}` : value
}

export function findVariant(evaluation: MatchingEvaluation, solutionId: string, acquisition: AcquisitionModel): RankedVariant | null {
  return evaluation.variants.find((v) => v.solutionId === solutionId && v.acquisition === acquisition) ?? null
}

export function recommendedVariant(evaluation: MatchingEvaluation): RankedVariant | null {
  const r = evaluation.recommended
  return r ? findVariant(evaluation, r.solutionId, r.acquisition) : null
}

/** Покупка и RaaS одного решения — колонки таблицы «Сравнить с текущим процессом». */
export function scenariosOf(evaluation: MatchingEvaluation, solutionId: string): readonly RankedVariant[] {
  return (['purchase', 'raas'] as const)
    .map((a) => findVariant(evaluation, solutionId, a))
    .filter((v): v is RankedVariant => v !== null)
}

/** Исключённые, которые пользователь добавил вручную, — в порядке добавления. */
export function manualEntries(excluded: readonly ExcludedSolution[], ids: readonly string[]): readonly ExcludedSolution[] {
  return ids
    .map((id) => excluded.find((e) => e.solutionId === id))
    .filter((e): e is ExcludedSolution => e !== undefined)
}

// «Параметры расчёта» (PRD 11.3, ТЗ 3.5.3). Диапазоны в PRD не заданы — разумные границы команды (D-97).

export interface CalcFieldSpec {
  readonly key: keyof CalcParams
  /** Во сколько раз значение в поле меньше хранимого: обслуживание вводится в млн ₽. */
  readonly scale: number
  readonly digits: number
  /** Границы в единицах поля. */
  readonly min: number
  readonly max: number
  /** Поле относится к выбранному решению: подпись «… · AMR 800». */
  readonly perSolution: boolean
}

/** Поля панели; горизонт не короче норматива А5 `horizon_years` — он же горизонт по умолчанию. */
export const calcFields = (minHorizonYears: number): readonly CalcFieldSpec[] => [
  { key: 'staffCostRubPerMonth', scale: 1, digits: 0, min: 20_000, max: 1_000_000, perSolution: false },
  { key: 'workHoursPerDay', scale: 1, digits: 1, min: 1, max: 24, perSolution: false },
  { key: 'robotTripsPerHour', scale: 1, digits: 2, min: 0.5, max: 100, perSolution: true },
  { key: 'robotPriceRub', scale: 1, digits: 0, min: 10_000, max: 200_000_000, perSolution: true },
  { key: 'serviceCostRubPerYear', scale: MILLION, digits: 2, min: 0, max: 100, perSolution: false },
  { key: 'utilization', scale: 1, digits: 2, min: 0.05, max: 1, perSolution: false },
  { key: 'horizonYears', scale: 1, digits: 0, min: minHorizonYears, max: 15, perSolution: false },
]

/** Значение в единицах поля: «1,8» для 1 800 000 ₽ обслуживания. */
export const toFieldText = (spec: CalcFieldSpec, value: number): string => formatNumber(value / spec.scale, spec.digits)

export type FieldParse =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly error: string }

/** Пустое поле — исходное значение (null); иначе число в диапазоне, в хранимых единицах. */
export function parseCalcField(spec: CalcFieldSpec, text: string): FieldParse {
  if (text.trim() === '') return { ok: true, value: null }
  const parsed = parseDecimal(text)
  if (parsed === null) return { ok: false, error: t.params.numberError }
  if (parsed < spec.min || parsed > spec.max) {
    return { ok: false, error: t.params.rangeError(formatNumber(spec.min, spec.digits), formatNumber(spec.max, spec.digits)) }
  }
  return { ok: true, value: roundHalfUp(parsed, spec.digits) * spec.scale }
}

/** Правки без значений, совпадающих с исходными: пустое поле и исходное число — одно и то же. */
export function effectiveOverrides(overrides: Partial<CalcParams>, defaults: CalcParams | null): Partial<CalcParams> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([key, value]) => defaults?.[key as keyof CalcParams] !== value),
  )
}

const LEGAL_FORM = /^(?:ООО|ОАО|ЗАО|ПАО|АО|ИП)\s+/u

/** Бренд без организационно-правовой формы и кавычек: «ООО «Морос»» → «Морос» (строки рейтинга 2.1). */
export const brandOf = (manufacturer: string): string => manufacturer.trim().replace(LEGAL_FORM, '').replace(/^«(.*)»$/u, '$1')

/** «Морос · AMR · до 800 кг» — подпись решения в исключённых и строке вне рейтинга. */
export function solutionLine(manufacturer: string, robot: Robot | undefined): string {
  const payload = robot?.specs.payloadKg
  return [brandOf(manufacturer), robot?.subtype, payload === undefined ? null : ru.catalog.comparePage.payloadUpTo(formatNumber(payload))]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/** Сообщение проверки расчёта: «нужно ≥ 800 кг, есть 10 кг». */
const NEED_HAVE = /^нужно (.+), есть (.+)$/u

/** Подпись внутри фразы со строчной: «класс операции», но «OP-01», «CAPEX». */
export const inline = (label: string): string =>
  label.length > 1 && label.charAt(1) === label.charAt(1).toLocaleLowerCase('ru') ? label.charAt(0).toLocaleLowerCase('ru') + label.slice(1) : label

/** Причины исключения полностью: «Класс операции: нужно OP-01…, есть OP-08…» (отчёт 09, `VariantsSection`). */
export const reasonsText = (solution: ExcludedSolution): string =>
  solution.reasons.map((r) => (r.message ? `${r.label}: ${r.message}` : r.label)).join(' · ')

/** Причины исключения коротко, как в макете: «грузоподъёмность 10 кг вместо ≥ 800 кг; среда улица вместо в помещении» (16742:183). */
export const shortReasonsText = (solution: ExcludedSolution): string =>
  solution.reasons
    .map((r) => {
      const match = r.message === null ? null : NEED_HAVE.exec(r.message)
      if (match) return t.reason(inline(r.label), match[2] ?? '', match[1] ?? '')
      return r.message === null ? inline(r.label) : `${inline(r.label)}: ${r.message}`
    })
    .join('; ')
