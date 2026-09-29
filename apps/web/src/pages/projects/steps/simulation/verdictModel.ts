import {
  canProceedToEconomics,
  type CostItem,
  type Fleet,
  type RankedVariant,
  type RunKpis,
  type SimulationRun,
} from '@/domain'
import { formatNumber, formatPercent, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.verdict

export const sameFleet = (a: Fleet, b: Fleet): boolean => a.robots === b.robots && a.stations === b.stations

/** План вердикта: сохранённый или рекомендация симуляции (PRD 11.4: «рекомендация уже подставлена»). */
export const planOf = (stored: Fleet | null, run: SimulationRun): Fleet => stored ?? run.to

/** Что записать в план: рекомендация симуляции хранится как null — она «уже подставлена» и следует за прогоном. */
export const planToStore = (next: Fleet, run: SimulationRun): Fleet | null => (sameFleet(next, run.to) ? null : next)

/** Каким прогоном проверен состав плана: итоговый `to` или проверенный `from`; null — не проверялся (07c). */
export type PlanCheck = { readonly kind: 'to' | 'from'; readonly kpis: RunKpis } | null

export function planCheck(run: SimulationRun, plan: Fleet): PlanCheck {
  if (sameFleet(plan, run.to)) return { kind: 'to', kpis: { peak: run.peak, onTimeWorstDay: run.onTimeWorstDay, utilizationPeak: run.utilizationPeak, fleetShares: run.fleetShares } }
  if (sameFleet(plan, run.from)) return { kind: 'from', kpis: run.before }
  return null
}

/**
 * Главное действие вердикта (D-104): переход закрыт при узком месте и недостижимом составе; «нужно докупить» с прежним
 * составом — только с принятым риском (07b); непроверенный состав — сначала прогон (07c).
 */
export type VerdictAction = 'closed' | 'accept' | 'acceptRisk' | 'rerun'

export function verdictAction(run: SimulationRun, plan: Fleet, acceptRisk: boolean): VerdictAction {
  if (!canProceedToEconomics(run.verdict)) return 'closed'
  if (run.verdict === 'need_more' && acceptRisk) return 'acceptRisk'
  const check = planCheck(run, plan)
  if (check?.kind === 'to') return 'accept'
  if (check?.kind === 'from' && run.verdict !== 'need_more') return 'accept'
  return 'rerun'
}

/** Риск можно принять только у «нужно докупить»: прежний состав не вывозит поток (PRD 11.4). */
export const canAcceptRisk = (run: SimulationRun): boolean => run.verdict === 'need_more'

/** Дельта плана к проверенному составу: «+1», «−2»; без изменения — null (чип «без изменений», 3.4). */
export const planDelta = (value: number, base: number): string | null => (value === base ? null : formatNumber(value - base, 0, { signed: true }))

/** Статьи, которые растут с числом роботов и станций (D-104); остальные — на объект целиком. */
const PER_ROBOT = new Set(['capex.equipment', 'opex.annual_raas_cost', 'opex.annual_energy_cost', 'opex.annual_service_cost'])
const PER_STATION = new Set(['capex.charging'])

export interface EconomicsPreview {
  readonly capexRub: number
  /** OPEX роботов в год: статьи на робота (платёж RaaS, энергия, сервис) по составу плана (3.4). */
  readonly robotOpexRub: number
  readonly annualEffectRub: number
  /** null — не окупается. */
  readonly paybackYears: number | null
  /** Загрузка парка 0–1; null — нет в расчёте подбора. */
  readonly utilization: number | null
}

/** Прирост статей при масштабировании: статья × (новое ÷ исходное − 1). */
function scaled(items: readonly CostItem[], codes: ReadonlySet<string>, ratio: number): number {
  return items.filter((item) => codes.has(item.code)).reduce((sum, item) => sum + item.amountRub * (ratio - 1), 0)
}

/**
 * «Экономика, предварительно» (PRD 11.4; D-104): от варианта подбора. Статьи на робота и на станцию масштабируются
 * по составу плана; эффект = эффект подбора − прирост OPEX; окупаемость = CAPEX ÷ эффект;
 * загрузка — поток тот же, роботов больше или меньше: загрузка подбора × роботов подбора ÷ роботов плана.
 */
export function previewEconomics(variant: RankedVariant, fleet: Fleet): EconomicsPreview {
  const robotRatio = fleet.robots / variant.robots
  const stationRatio = variant.stations ? fleet.stations / variant.stations : 1
  const capexRub = variant.capexRub + scaled(variant.capexItems, PER_ROBOT, robotRatio) + scaled(variant.capexItems, PER_STATION, stationRatio)
  const opexGrowth = scaled(variant.opexItems, PER_ROBOT, robotRatio)
  const annualEffectRub = variant.annualEffectRub - opexGrowth
  const robotOpexRub = variant.opexItems.filter((item) => PER_ROBOT.has(item.code)).reduce((sum, item) => sum + item.amountRub, 0) + opexGrowth
  return {
    capexRub,
    robotOpexRub,
    annualEffectRub,
    paybackYears: annualEffectRub > 0 ? capexRub / annualEffectRub : null,
    utilization: variant.fleetUtilization === null ? null : Math.min(1, variant.fleetUtilization / robotRatio),
  }
}

/** Изменение к подбору: «+4 %», «−4 %»; `worse` — для склада хуже (CAPEX, OPEX и окупаемость растут, эффект падает). */
export interface EconomicsChange {
  readonly text: string
  readonly worse: boolean
}

export interface EconomicsRow {
  readonly key: 'capex' | 'opex' | 'effect' | 'payback'
  readonly label: string
  readonly from: string
  readonly to: string
  /** null — значение не изменилось или его нет. */
  readonly change: EconomicsChange | null
}

const rub = (value: number): string => formatRubCompact(value, { fractionDigits: 1 })
const years = (value: number | null): string => (value === null ? t.economics.noPayback : formatYears(value))

/** Относительное изменение со знаком, до целого процента (3.4: «+4 %»); меньше полупроцента — изменения нет. */
function change(from: number | null, to: number | null, higherIsWorse: boolean): EconomicsChange | null {
  if (from === null || to === null || from === 0) return null
  const share = (to - from) / Math.abs(from)
  if (Math.abs(share) < 0.005) return null
  return { text: formatPercent(share, 0, { signed: true }), worse: higherIsWorse ? share > 0 : share < 0 }
}

/** «Экономика, предварительно» (3.4, 16414:3663): из подбора → с изменениями и изменение в процентах. */
export function economicsRows(variant: RankedVariant, plan: Fleet): readonly EconomicsRow[] {
  const from = previewEconomics(variant, { robots: variant.robots, stations: variant.stations ?? plan.stations })
  const to = previewEconomics(variant, plan)
  const r = t.economics.rows
  return [
    { key: 'capex', label: r.capex, from: rub(from.capexRub), to: rub(to.capexRub), change: change(from.capexRub, to.capexRub, true) },
    { key: 'opex', label: r.opex, from: rub(from.robotOpexRub), to: rub(to.robotOpexRub), change: change(from.robotOpexRub, to.robotOpexRub, true) },
    { key: 'effect', label: r.effect, from: rub(from.annualEffectRub), to: rub(to.annualEffectRub), change: change(from.annualEffectRub, to.annualEffectRub, false) },
    { key: 'payback', label: r.payback, from: years(from.paybackYears), to: years(to.paybackYears), change: change(from.paybackYears, to.paybackYears, true) },
  ]
}

/** «в худший день в срок 98,4 % · 130 из 130 рейсов в пик» — итоги состава. */
export const kpisLine = (kpis: RunKpis): string =>
  t.meta(formatPercent(kpis.onTimeWorstDay, 1), formatNumber(kpis.peak.servedPerHour), formatNumber(kpis.peak.requiredPerHour))

/** Доля потребности, которую прежний состав вывозит в пик: «93,8 %» (07b). */
export const servedShare = (kpis: RunKpis): string => formatPercent(kpis.peak.servedPerHour / kpis.peak.requiredPerHour, 1)
