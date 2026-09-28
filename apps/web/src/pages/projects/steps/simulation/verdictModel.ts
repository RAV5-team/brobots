import {
  canProceedToEconomics,
  type CostItem,
  type Fleet,
  type RankedVariant,
  type RunKpis,
  type SimulationRun,
} from '@/domain'
import { formatCount, formatNumber, formatPercent, formatRubCompact, formatYears, pluralize, type PluralForms } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.verdict
const plural = ru.plural

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

const signed = (n: number): string => formatNumber(n, 0, { signed: true })

/** Плашка плана: «Экономия 2 роботов и 1 станции», «Докупка 3 роботов», «Без изменений» — от проверенного состава. */
export function planChangeLabel(from: Fleet, plan: Fleet): string {
  const dr = plan.robots - from.robots
  const ds = plan.stations - from.stations
  if (dr === 0 && ds === 0) return t.plan.noChange
  if (dr <= 0 && ds <= 0 || dr >= 0 && ds >= 0) {
    const parts = [
      dr === 0 ? null : formatCount(Math.abs(dr), plural.robotsOf),
      ds === 0 ? null : formatCount(Math.abs(ds), plural.stationsOf),
    ].filter((p): p is string => p !== null).join(t.plan.and)
    return dr < 0 || ds < 0 ? t.plan.saving(parts) : t.plan.purchase(parts)
  }
  const part = (delta: number, forms: PluralForms): string => `${signed(delta)}\u00a0${pluralize(Math.abs(delta), forms)}`
  return t.plan.mixed(`${part(dr, plural.robots)}${t.plan.and}${part(ds, plural.stations)}`)
}

/** Дельта строки плана: «−2», «+3»; без изменения — не показывается. */
export const planDelta = (value: number, base: number): string | undefined => (value === base ? undefined : signed(value - base))

/** Статьи, которые растут с числом роботов и станций (D-104); остальные — на объект целиком. */
const PER_ROBOT = new Set(['capex.equipment', 'opex.annual_raas_cost', 'opex.annual_energy_cost', 'opex.annual_service_cost'])
const PER_STATION = new Set(['capex.charging'])

export interface EconomicsPreview {
  readonly capexRub: number
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
  const annualEffectRub = variant.annualEffectRub - scaled(variant.opexItems, PER_ROBOT, robotRatio)
  return {
    capexRub,
    annualEffectRub,
    paybackYears: annualEffectRub > 0 ? capexRub / annualEffectRub : null,
    utilization: variant.fleetUtilization === null ? null : Math.min(1, variant.fleetUtilization / robotRatio),
  }
}

export interface EconomicsRow {
  readonly key: 'capex' | 'effect' | 'payback' | 'utilization'
  readonly label: string
  readonly from: string
  readonly to: string
  readonly delta: string
}

const rub = (value: number): string => formatRubCompact(value, { fractionDigits: 1 })
const MILLION = 1_000_000
/** Разница — в миллионах, как суммы колонок: «−0,5 млн ₽»; меньше 0,05 млн — «0». */
const signedRub = (delta: number): string => {
  const text = formatNumber(delta / MILLION, 1, { signed: true })
  return text === '0' ? text : `${text}\u00a0млн\u00a0₽`
}
const years = (value: number | null): string => (value === null ? t.economics.noPayback : formatYears(value))
const signedYears = (a: number | null, b: number | null): string => {
  if (a === null || b === null) return '—'
  return formatNumber(b - a, 1, { signed: true })
}

/** Строки таблицы «из подбора → с изменениями». */
export function economicsRows(variant: RankedVariant, plan: Fleet): readonly EconomicsRow[] {
  const from = previewEconomics(variant, { robots: variant.robots, stations: variant.stations ?? plan.stations })
  const to = previewEconomics(variant, plan)
  const r = t.economics.rows
  const rows: EconomicsRow[] = [
    { key: 'capex', label: r.capex, from: rub(from.capexRub), to: rub(to.capexRub), delta: signedRub(to.capexRub - from.capexRub) },
    { key: 'effect', label: r.effect, from: rub(from.annualEffectRub), to: rub(to.annualEffectRub), delta: signedRub(to.annualEffectRub - from.annualEffectRub) },
    { key: 'payback', label: r.payback, from: years(from.paybackYears), to: years(to.paybackYears), delta: signedYears(from.paybackYears, to.paybackYears) },
  ]
  if (from.utilization === null || to.utilization === null) return rows
  return [...rows, {
    key: 'utilization',
    label: r.utilization,
    from: formatPercent(from.utilization),
    to: formatPercent(to.utilization),
    delta: t.economics.points(formatNumber((to.utilization - from.utilization) * 100, 0, { signed: true })),
  }]
}

/** «в худший день в срок 98,4 % · 130 из 130 рейсов в пик» — итоги состава. */
export const kpisLine = (kpis: RunKpis): string =>
  t.meta(formatPercent(kpis.onTimeWorstDay, 1), formatNumber(kpis.peak.servedPerHour), formatNumber(kpis.peak.requiredPerHour))

/** Доля потребности, которую прежний состав вывозит в пик: «93,8 %» (07b). */
export const servedShare = (kpis: RunKpis): string => formatPercent(kpis.peak.servedPerHour / kpis.peak.requiredPerHour, 1)
