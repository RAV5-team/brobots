import type { RangeRow } from '@/components/charts/RangeBar'
import {
  cumulativeCashFlow,
  effectChain,
  lowestOf,
  sensitivity,
  staffEquivalent,
  type AcquisitionModel,
  type ConditionRow,
  type CostItem,
  type EconomicsResult,
  type ScenarioEconomics,
  type SensitivityResult,
  type ShiftedResult,
  type SimulationRun,
} from '@/domain'
import { formatCount, formatNumber, formatPercent, formatRubCompact, roundHalfUp } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { ProcessFacts } from './economicsView'
import { acquisitionName, fleetText, money, operationRub, years } from './economicsView'

const t = ru.project.economics
const plural = ru.plural
const YEARS = ru.project.matching.plural.years
const M = 1_000_000

export type ColumnKey = 'current' | AcquisitionModel

/** Строка «Сравнения сценариев»: значение по колонке и метка лучшего значения. */
export interface ScenarioRow {
  readonly key: string
  readonly label: string
  readonly values: Readonly<Record<ColumnKey, string>>
  readonly mark?: { readonly column: ColumnKey; readonly text: string }
}

interface ScenarioContext {
  readonly economics: EconomicsResult
  readonly scenarios: readonly ScenarioEconomics[]
  readonly facts: ProcessFacts | null
  readonly run: SimulationRun | null
  readonly conditions: readonly ConditionRow[]
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)

/** Ставки экономии ФОТ: «≈ 9 ставок» (PRD 11.5); нет оклада — только сумма. */
function laborText(value: number | null, facts: ProcessFacts | null): string {
  if (value === null) return '—'
  const salary = facts?.staff?.salaryRub
  if (!salary) return money(value)
  return t.scenarios.values.labor(money(value), formatCount(Math.round(staffEquivalent(value, salary)), plural.rates))
}

/**
 * «Сравнение сценариев» (PRD 11.5): текущий процесс, покупка и RaaS по единым показателям (ТЗ 3.5.5).
 * Числа — из сценариев; производные (снижение, ставки, накопленный результат, стоимость операции) вычисляются.
 */
export function scenarioRows({ economics, scenarios, facts, run, conditions }: ScenarioContext): readonly ScenarioRow[] {
  const v = t.scenarios.values
  const horizon = formatCount(economics.horizonYears, YEARS)
  const current = economics.current
  const by = (value: (s: ScenarioEconomics) => string): Record<AcquisitionModel, string> => {
    const out: Record<AcquisitionModel, string> = { purchase: '—', raas: '—' }
    return scenarios.reduce((acc, s) => ({ ...acc, [s.acquisition]: value(s) }), out)
  }
  const row = (key: string, label: string, currentValue: string, value: (s: ScenarioEconomics) => string, mark?: ScenarioRow['mark']): ScenarioRow =>
    ({ key, label, values: { current: currentValue, ...by(value) }, ...(mark ? { mark } : {}) })

  const staff = facts?.staff
  const peak = run ? v.simulated(formatNumber(run.peak.servedPerHour), formatNumber(run.peak.requiredPerHour)) : v.calcOnly
  const blocking = conditions.filter((c) => c.blocksConclusion && c.status !== 'confirmed').map((c) => lowerFirst(c.parameter)).join(', ')
  const hasTariffAssumption = conditions.some((c) => c.acquisition === 'raas' && c.status === 'assumption')
  const capexLeader = lowestOf(scenarios.map((s) => ({ key: s.acquisition, value: s.capexRub })))
  const tcoLeader = lowestOf<ColumnKey>([{ key: 'current', value: current.tcoRub }, ...scenarios.map((s) => ({ key: s.acquisition, value: s.tcoRub }))])
  const lastYear = economics.horizonYears

  return [
    row('fleet', t.scenarios.rows.fleet,
      staff?.headcount ? v.staff(formatCount(staff.headcount, plural.people), staff.role) : '—',
      (s) => v.fleet(s.robots, economics.solutionName, s.stations === null ? '—' : formatCount(s.stations, plural.stations))),
    row('check', t.scenarios.rows.check, v.fact, () => peak),
    row('capex', t.scenarios.rows.capex, '—', (s) => money(s.capexRub), capexLeader ? { column: capexLeader, text: t.scenarios.marks.capex } : undefined),
    row('raas', t.scenarios.rows.raas, v.notApplicable, (s) => (s.raasMonthlyRub === null ? v.notApplicable : formatRubCompact(s.raasMonthlyRub))),
    row('opex', t.scenarios.rows.opex, money(current.opexRubPerYear), (s) => money(s.opexRubPerYear)),
    row('reduction', t.scenarios.rows.reduction, '—', (s) => {
      const delta = current.opexRubPerYear - s.opexRubPerYear
      return v.reduction(money(delta), formatPercent(delta / current.opexRubPerYear))
    }),
    row('labor', t.scenarios.rows.labor, '—', (s) => laborText(s.laborSavingsRubPerYear, facts)),
    row('effect', t.scenarios.rows.effect, '—', (s) => money(s.annualEffectRub)),
    row('payback', t.scenarios.rows.payback, '—', (s) => years(s.paybackYears)),
    row('roi', t.scenarios.rows.roi(horizon), '—', (s) => (s.roi === null ? '—' : formatPercent(s.roi))),
    row('tco', t.scenarios.rows.tco(horizon), money(current.tcoRub), (s) => money(s.tcoRub), tcoLeader ? { column: tcoLeader, text: t.scenarios.marks.tco } : undefined),
    row('cumulative', t.scenarios.rows.cumulative(lastYear), '—', (s) => money(cumulativeCashFlow(s, lastYear).at(-1) ?? null)),
    row('operation', t.scenarios.rows.operation,
      operationRub(current.opexRubPerYear, economics.operationsPerDay),
      (s) => operationRub(s.opexRubPerYear, economics.operationsPerDay)),
    row('conditions', t.scenarios.rows.conditions, '—', (s) => {
      if (s.acquisition === 'raas' && scenarios.length > 1 && hasTariffAssumption) return `${v.same}; ${v.tariff}`
      return blocking || '—'
    }),
  ]
}

/** Строка цепочки эффекта. */
export interface ChainRow {
  readonly key: string
  readonly label: string
  readonly note: string
  readonly amount: string
  readonly total: boolean
}

export function chainRows(scenario: ScenarioEconomics, economics: EconomicsResult, facts: ProcessFacts | null, newItems: readonly CostItem[]): readonly ChainRow[] {
  const c = effectChain(scenario, economics.current)
  const staffNote = (() => {
    const salary = facts?.staff?.salaryRub
    return salary ? t.costs.notes.labor(formatCount(Math.round(staffEquivalent(c.laborSavingsRub, salary)), plural.rates)) : ''
  })()
  const signed = (sign: '−' | '+', value: number) => `${sign} ${money(value)}`
  return [
    { key: 'current', label: t.costs.chain.current, note: t.costs.notes.current, amount: money(c.currentRub), total: false },
    { key: 'labor', label: t.costs.chain.labor, note: staffNote, amount: signed('−', c.laborSavingsRub), total: false },
    { key: 'other', label: t.costs.chain.other, note: t.costs.notes.other, amount: signed('−', c.otherEffectRub), total: false },
    { key: 'new', label: t.costs.chain.newCosts, note: newItems.map((i) => `${lowerFirst(i.label)} ${money(i.amountRub)}`).join(' + '), amount: signed('+', c.newCostsRub), total: false },
    { key: 'after', label: t.costs.chain.after, note: '', amount: money(c.afterRub), total: true },
    { key: 'effect', label: t.costs.chain.effect, note: t.costs.notes.effect, amount: money(c.effectRub), total: true },
  ]
}

/** Накопленный денежный поток по годам в млн ₽ с одним знаком — те же числа, что над столбцами. */
export function cashFlowMillions(scenario: Pick<ScenarioEconomics, 'capexRub' | 'annualEffectRub'>, horizonYears: number): readonly number[] {
  return cumulativeCashFlow(scenario, horizonYears).map((value) => roundHalfUp(value / M, 1))
}

/** Строка устойчивости экрана: таблица PRD и отрезок для RangeBar. */
export interface SensitivityView {
  readonly key: string
  readonly label: string
  readonly base: string
  readonly payback: string
  readonly tco: string
  readonly conclusion: string
  readonly range: RangeRow
}

const paybackNumber = (r: ShiftedResult, cap: number): number => r.paybackYears ?? cap

function baseValue(parameter: SensitivityResult['parameter'], scenario: ScenarioEconomics, facts: ProcessFacts | null): string {
  const s = t.sensitivity
  if (parameter === 'labor') return facts?.staff?.salaryRub ? s.perMonth(formatRubCompact(facts.staff.salaryRub)) : '—'
  if (parameter === 'volume') return facts ? s.perDay(facts.volume) : '—'
  const code = scenario.acquisition === 'raas' ? 'opex.annual_raas_cost' : 'capex.equipment'
  const items = scenario.acquisition === 'raas' ? scenario.opexItems : scenario.capexItems
  const total = items.find((i) => i.code === code)?.amountRub
  if (total === undefined) return '—'
  const perRobot = total / scenario.robots
  return scenario.acquisition === 'raas' ? s.perRobotMonth(formatRubCompact(perRobot / 12)) : formatRubCompact(perRobot)
}

/**
 * «Устойчивость результата» сценария (PRD 11.5; ТЗ 3.5.6): три параметра ±20 %, сверху — самый влиятельный
 * (наибольший разброс окупаемости). Не окупается — отрезок до конца горизонта.
 */
export function sensitivityView(scenario: ScenarioEconomics, others: readonly ScenarioEconomics[], economics: EconomicsResult, facts: ProcessFacts | null): readonly SensitivityView[] {
  const s = t.sensitivity
  const rows = sensitivity(scenario, others, economics.current, economics.horizonYears)
  const cap = economics.horizonYears
  return [...rows]
    .sort((a, b) => Math.abs(paybackNumber(b.minus, cap) - paybackNumber(b.plus, cap)) - Math.abs(paybackNumber(a.minus, cap) - paybackNumber(a.plus, cap)))
    .map((row) => {
      const label = row.parameter === 'price' ? s.params[scenario.acquisition] : s.params[row.parameter]
      const low = Math.min(paybackNumber(row.minus, cap), paybackNumber(row.plus, cap))
      const high = Math.max(paybackNumber(row.minus, cap), paybackNumber(row.plus, cap))
      const lowText = formatNumber(low, 1)
      const highResult = paybackNumber(row.minus, cap) >= paybackNumber(row.plus, cap) ? row.minus : row.plus
      const conclusion = !row.staysPositive ? s.negative : row.flipsTo ? s.flips(s.flipTargets[row.flipsTo]) : s.stays
      const tco = s.pair(money(row.minus.tcoRub), money(row.plus.tcoRub))
      return {
        key: row.parameter,
        label,
        base: baseValue(row.parameter, scenario, facts),
        payback: s.pair(years(row.minus.paybackYears), years(row.plus.paybackYears)),
        tco: row.parameter === 'volume' ? `${tco} · ${s.fleet(row.minus.robots, row.plus.robots)}` : tco,
        conclusion,
        range: { key: row.parameter, label, from: low, to: high, valueText: s.range(lowText, years(highResult.paybackYears)) },
      }
    })
}

/** Колонка сравнения для чтения с экрана и CSV: «RaaS · 18 роботов». */
export const columnName = (acquisition: AcquisitionModel, scenario: ScenarioEconomics): string =>
  `${acquisitionName(acquisition)} · ${fleetText(scenario.robots, scenario.stations)}`
