import type { FormulaStat } from '@/components/ui/FormulaStats'
import type { CalcParams, CostItem, MatchBaseline, MatchingEvaluation, Project, ProjectParamsSnapshot, RankedVariant, ScoreContribution } from '@/domain'
import { formatNumber, formatPercent, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { assumptionRows, peakDemand, peakDemandFormula, type PeakDemand } from '../params/paramsModel'
import { formatScore } from './matchingModel'

const h = ru.project.matching.howCalc
const MILLION = 1_000_000
const SECONDS_PER_HOUR = 3_600
/** Статьи сходятся с итогом, если разница меньше округления до 0,1 млн ₽. */
const ITEMS_TOLERANCE_RUB = 50_000
/** Сумма вкладов равна баллу с точностью до округления баллов до сотых (PRD 15 · №20). */
export const SCORE_TOLERANCE = 0.005

export type HowCalcSectionKey = keyof typeof h.sections

export interface HowCalcSection {
  readonly key: HowCalcSectionKey
  readonly title: string
  readonly stats: readonly FormulaStat[]
}

export interface HowCalcInput {
  readonly variant: RankedVariant
  readonly processName: string
  /** Потребность в пик по снимку шага 1; null — не посчитать. */
  readonly demand: PeakDemand | null
  /** Параметры, с которыми посчитан подбор (исходные «Параметры расчёта»). */
  readonly params: CalcParams | null
  readonly baseline: MatchBaseline | null
}

/**
 * Процесс проекта и его потребность в пик — как на шаге 1: пик с уточнением допущения, часы — из «Параметров расчёта».
 * Общая для «Как рассчитано» (03a) и «Как рассчитал подбор» симуляции (04).
 */
export function demandOf(snapshot: ProjectParamsSnapshot, evaluation: MatchingEvaluation, project: Project): { readonly processName: string; readonly demand: PeakDemand | null } {
  const entry = snapshot.processes.find((p) => p.locationProcess.id === project.locationProcessId)
  if (!entry) return { processName: '', demand: null }
  const peak = assumptionRows(entry, snapshot, project.inputs.params.assumptions).find((a) => a.code === 'peak_factor')?.value ?? 1
  const hours = evaluation.calcDefaults?.workHoursPerDay ?? entry.process.defaults.workHoursPerDay
  return { processName: entry.locationProcess.name ?? entry.process.name, demand: peakDemand(entry, hours, peak) }
}

const millions = (value: number): string => formatNumber(value / MILLION, 1)
const rub = (value: number, perYear = false): string => formatRubCompact(value, { fractionDigits: 1, perYear })

/** «станции 3,1 + подготовка 0,5 + …» — только если статьи сходятся с итогом, иначе разложения нет. */
function itemsFormula(items: readonly CostItem[], total: number): string {
  const sum = items.reduce((acc, i) => acc + i.amountRub, 0)
  if (items.length === 0 || Math.abs(sum - total) > ITEMS_TOLERANCE_RUB) return h.noItems
  return h.itemsFormula(items.map((i) => `${i.label.toLocaleLowerCase('ru')} ${millions(i.amountRub)}`).join(' + '))
}

/** Сумма вкладов критериев; null — хотя бы у одного критерия вклада нет. */
export function contributionsSum(criteria: readonly ScoreContribution[]): number | null {
  if (criteria.length === 0 || criteria.some((c) => c.contribution === null)) return null
  return criteria.reduce((acc, c) => acc + (c.contribution ?? 0), 0)
}

function demandStats({ demand, processName }: HowCalcInput): readonly FormulaStat[] {
  const l = h.labels
  if (!demand) return [{ key: 'peak', label: l.peak, value: h.noData, formula: h.noRecounts }]
  return [
    { key: 'volume', label: l.volume, value: h.perDay(formatNumber(demand.perDay), demand.unit), formula: h.volumeFormula(processName) },
    { key: 'peak', label: l.peak, value: h.perHour(formatNumber(demand.perHour), demand.unit), formula: peakDemandFormula(demand) },
  ]
}

function fleetStats({ variant: v, demand, params }: HowCalcInput): readonly FormulaStat[] {
  const l = h.labels
  // Цикл есть только у решения, для которого заданы «Параметры расчёта»: его производительность и идёт в парк.
  // Из цикла и загрузки выходит 8,65, в расчёте — 8,6 (PRD 15 · №109): показываем обе.
  const productivity = v.cycleTimeS !== null && params ? params.robotTripsPerHour : null
  const stats: (FormulaStat | null)[] = [
    v.cycleTimeS === null ? null : { key: 'cycle', label: l.cycle, value: h.seconds(formatNumber(v.cycleTimeS)), formula: h.cycleFormula },
    productivity === null || v.cycleTimeS === null || params === null
      ? null
      : {
          key: 'productivity',
          label: l.productivity,
          value: h.trips(formatNumber(productivity, 2)),
          formula: h.productivityFormula(formatNumber(SECONDS_PER_HOUR), formatNumber(v.cycleTimeS), formatNumber(params.utilization, 2), formatNumber(SECONDS_PER_HOUR / v.cycleTimeS * params.utilization, 2)),
        },
    {
      key: 'robots',
      label: l.robots,
      value: formatNumber(v.robots),
      formula: demand && productivity
        ? h.robotsFormula(formatNumber(demand.perHour), formatNumber(productivity, 2), formatNumber(demand.perHour / productivity, 1))
        : h.noItems,
    },
    v.stations === null || v.stations === 0
      ? null
      : { key: 'stations', label: l.stations, value: formatNumber(v.stations), formula: h.stationsFormula(formatNumber(v.robots), formatNumber(v.stations), formatNumber(v.robots / v.stations, 1)) },
    v.fleetUtilization === null ? null : { key: 'utilization', label: l.utilization, value: formatPercent(v.fleetUtilization), formula: h.utilizationFormula },
  ]
  return stats.filter((s): s is FormulaStat => s !== null)
}

function moneyStats({ variant: v, baseline }: HowCalcInput): readonly FormulaStat[] {
  const l = h.labels
  const remaining = v.opexItems.find((i) => i.code === 'labor.remaining_annual_payroll')?.amountRub ?? null
  const labor = v.laborSavingsRubPerYear
  const stats: (FormulaStat | null)[] = [
    { key: 'capex', label: l.capex, value: rub(v.capexRub), formula: itemsFormula(v.capexItems, v.capexRub) },
    { key: 'opex', label: l.opex, value: rub(v.opexRubPerYear, true), formula: itemsFormula(v.opexItems, v.opexRubPerYear) },
    labor === null
      ? null
      : { key: 'labor', label: l.labor, value: rub(labor, true), formula: remaining === null ? h.noItems : h.laborFormula(millions(labor + remaining), millions(remaining)) },
    {
      key: 'effect',
      label: l.effect,
      value: rub(v.annualEffectRub, true),
      formula: baseline ? h.effectFormula(millions(baseline.opexRubPerYear), millions(v.opexRubPerYear)) : h.noItems,
    },
    {
      key: 'payback',
      label: l.payback,
      value: v.paybackYears === null ? ru.project.matching.ranking.notPaying : formatYears(v.paybackYears),
      formula: v.paybackYears === null ? h.noPayback : h.paybackFormula(millions(v.capexRub), millions(v.annualEffectRub)),
    },
  ]
  return stats.filter((s): s is FormulaStat => s !== null)
}

/** Вклад каждого критерия с весом и итог — балл варианта; сумма вкладов показана рядом (PRD 11.3, №20). */
function scoreStats({ variant: v }: HowCalcInput): readonly FormulaStat[] {
  const sum = contributionsSum(v.criteria)
  if (v.score === null || v.criteria.every((c) => c.contribution === null)) {
    return [{ key: 'total', label: h.labels.total, value: v.score === null ? h.noData : formatScore(v.score), formula: h.noScore }]
  }
  return [
    ...v.criteria.map((c) => ({
      key: c.code,
      label: c.label,
      value: c.contribution === null ? h.noContribution : formatScore(c.contribution),
      formula: h.weight(formatPercent(c.weight)),
    })),
    { key: 'total', label: h.labels.total, value: formatScore(v.score), formula: sum === null ? h.noScore : h.scoreFormula(formatScore(sum)) },
  ]
}

/** Четыре секции панели 03a: потребность → цикл и парк → деньги → балл рейтинга. */
export function howCalcSections(input: HowCalcInput): readonly HowCalcSection[] {
  const build: Record<HowCalcSectionKey, (i: HowCalcInput) => readonly FormulaStat[]> = {
    demand: demandStats, fleet: fleetStats, money: moneyStats, score: scoreStats,
  }
  return (Object.keys(build) as HowCalcSectionKey[]).map((key) => ({ key, title: h.sections[key], stats: build[key](input) }))
}
