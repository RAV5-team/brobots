import {
  type AcquisitionModel,
  type CheckStatus,
  type ConditionRow,
  type RankedVariant,
  type ScenarioEconomics,
  type SimulationRun,
} from '@/domain'
import { formatCount, formatDate, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { HowCalcSectionKey } from '../steps/matching/howCalculatedModel'
import { conditionValue, contributionsText, findVariant, formatScore, topContributions } from '../steps/matching/matchingModel'
import { missingOf } from '../steps/params/paramsModel'
import {
  acquisitionName,
  conclusionView,
  conditionsFor,
  fleetText,
  money,
  operationRub,
  processFacts,
  selectedAcquisition,
  shownScenario,
  simulationOutcome,
  years,
  type ConclusionView,
  type ProcessFacts,
} from '../steps/economics/economicsView'
import type { ReportData } from './useReport'

const t = ru.report
const r = ru.project.economics.recommendation
const YEARS = ru.project.matching.plural.years
/** Порядок сценариев — как на итоге 08: покупка, затем RaaS. */
const ORDER: readonly AcquisitionModel[] = ['purchase', 'raas']

/** Кто смотрит отчёт: сохранённая оценка, черновик пользователя или гость (D-14, D-17). */
export type ReportMode = 'saved' | 'draft' | 'guest'

/** Общий контекст отчёта: те же сценарий, вывод и условия, что у итога 08, — числа совпадают. */
export interface ReportContext extends ReportData {
  readonly mode: ReportMode
  readonly selected: AcquisitionModel
  readonly scenario: ScenarioEconomics
  /** Все сценарии выбранного решения в порядке 08. */
  readonly scenarios: readonly ScenarioEconomics[]
  readonly others: readonly ScenarioEconomics[]
  readonly variant: RankedVariant | null
  readonly facts: ProcessFacts | null
  readonly conditions: readonly ConditionRow[]
  readonly conclusion: ConclusionView
  readonly horizon: string
  /** Дата расчёта: сохранения или последней правки черновика, «26.09.2026». */
  readonly calcDate: string
}

export function reportContext(data: ReportData, isGuest: boolean): ReportContext | null {
  const { project, economics, matching, snapshot, run } = data
  const selected = selectedAcquisition(project)
  const scenarios = ORDER.flatMap((a) => { const s = shownScenario(economics, project, a); return s ? [s] : [] })
  const scenario = scenarios.find((s) => s.acquisition === selected) ?? scenarios[0]
  if (!scenario) return null
  const conditions = conditionsFor(economics.conditions, scenario.acquisition)
  const mode: ReportMode = isGuest ? 'guest' : project.status === 'saved' ? 'saved' : 'draft'
  return {
    ...data,
    mode,
    selected: scenario.acquisition,
    scenario,
    scenarios,
    others: scenarios.filter((s) => s.acquisition !== scenario.acquisition),
    variant: findVariant(matching, economics.solutionId, scenario.acquisition),
    facts: processFacts(snapshot, project, (entry) => missingOf(entry, snapshot).length),
    conditions,
    conclusion: conclusionView(scenario, conditions, simulationOutcome(project, run), run),
    horizon: formatCount(economics.horizonYears, YEARS),
    calcDate: formatDate((project.status === 'saved' ? project.savedAt : project.updatedAt).slice(0, 10)),
  }
}

/** Шаги расчёта количества — «1. Потребность» и «2. Цикл и парк» панели 03a (D-100) идут в раздел 5; деньги и балл — в приложение. */
export const isCountSection = (key: HowCalcSectionKey): boolean => key === 'demand' || key === 'fleet'

export const scenarioName = (ctx: Pick<ReportContext, 'economics'>, acquisition: AcquisitionModel): string =>
  `${ctx.economics.solutionName} · ${acquisitionName(acquisition)}`

const roiText = (s: ScenarioEconomics): string => (s.roi === null ? '—' : formatPercent(s.roi))

const onTimeText = (run: SimulationRun): string => formatPercent(run.onTimeWorstDay, 1)

/** Абзац «Краткого заключения»: процесс, выбор, деньги, вывод, симуляция, альтернатива (PRD 11.6). */
export function abstractText(ctx: ReportContext): string {
  const a = t.summary.abstract
  const { scenario: s, run, facts } = ctx
  const parts = [
    a.process(facts?.name ?? '—', ctx.location.name, facts?.volume ?? '—'),
    a.choice(scenarioName(ctx, s.acquisition), fleetText(s.robots, s.stations)),
    a.money(money(s.capexRub), money(s.annualEffectRub), years(s.paybackYears), ctx.horizon, roiText(s)),
    a.conclusion(ctx.conclusion.title, ctx.conclusion.explanation),
    run ? a.simulation(formatNumber(run.peak.servedPerHour), formatNumber(run.peak.requiredPerHour), onTimeText(run)) : a.noSimulation,
    ...ctx.others.map((o) => a.alternative(acquisitionName(o.acquisition), money(o.capexRub), money(o.annualEffectRub), years(o.paybackYears))),
    ru.project.economics.scope(facts?.name ?? '—', ctx.location.name) + '.',
  ]
  return parts.join(' ')
}

/** «TCO за 5 лет: текущий процесс 234,0 млн ₽ · покупка … · RaaS …». */
export function tcoLine(ctx: ReportContext): string {
  const current = `${ru.project.economics.scenarios.current.toLowerCase()} ${money(ctx.economics.current.tcoRub)}`
  const values = [current, ...ctx.scenarios.map((s) => `${acquisitionName(s.acquisition)} ${money(s.tcoRub)}`)].join(' · ')
  return t.summary.tco(ctx.horizon, values)
}

/** Главный компромисс выбранного сценария против альтернативы: вложения против TCO за горизонт. */
export function tradeoffText(ctx: ReportContext): string {
  const v = t.summary.values
  const other = ctx.others[0]
  if (!other) return v.noAlternative
  const s = ctx.scenario
  const name = acquisitionName(s.acquisition)
  const otherName = acquisitionName(other.acquisition)
  const capexDelta = other.capexRub - s.capexRub
  const tcoDelta = s.tcoRub !== null && other.tcoRub !== null ? other.tcoRub - s.tcoRub : null
  if (tcoDelta === null) return v.noAlternative
  if (capexDelta > 0 && tcoDelta < 0) return v.cheaperStart(name, money(capexDelta), otherName, money(-tcoDelta), ctx.horizon)
  if (capexDelta < 0 && tcoDelta > 0) return v.cheaperLong(name, money(tcoDelta), otherName, money(-capexDelta), ctx.horizon)
  return v.dominates(otherName)
}

export interface SummaryRow {
  readonly key: keyof typeof t.summary.rows
  readonly label: string
  readonly value: string
}

/** Таблица первой страницы (PRD 11.6): девять строк от предмета оценки до статуса. */
export function summaryRows(ctx: ReportContext): readonly SummaryRow[] {
  const v = t.summary.values
  const { scenario: s, run, variant, facts, economics } = ctx
  const rank = s.rank === null ? r.outOfRank : r.rank(s.rank, economics.rankedTotal)
  const top = variant ? contributionsText(topContributions(variant.criteria)) : ''
  const blocking = ctx.conditions.filter((c) => c.blocksConclusion && c.status !== 'confirmed').map((c) => c.parameter)
  const status = {
    saved: v.saved(ctx.conclusion.title, ctx.calcDate),
    draft: v.draft(ctx.conclusion.title),
    guest: v.guest(ctx.conclusion.title),
  }[ctx.mode]
  const values: Record<SummaryRow['key'], string> = {
    subject: v.subject(facts?.name ?? '—', ctx.location.name, facts?.volume ?? '—', facts?.shiftsText ?? '—'),
    variant: `${scenarioName(ctx, s.acquisition)} · ${fleetText(s.robots, s.stations)} · ${economics.manufacturer}`,
    basis: v.basis(rank, variant?.score == null ? '' : v.score(formatScore(variant.score)), economics.recommended === s.acquisition, top),
    request: ctx.conclusion.nextStep,
    economics: v.economics(money(s.capexRub), money(s.annualEffectRub), years(s.paybackYears), ctx.horizon, money(s.tcoRub)),
    performance: run
      ? v.performance(run.id, formatNumber(run.peak.servedPerHour), formatNumber(run.peak.requiredPerHour), onTimeText(run))
      : v.noRun,
    tradeoff: tradeoffText(ctx),
    conditions: blocking.length > 0 ? blocking.join('; ') : v.allConfirmed,
    status,
  }
  return (Object.keys(t.summary.rows) as SummaryRow['key'][]).map((key) => ({ key, label: t.summary.rows[key], value: values[key] }))
}

export interface FactRow {
  readonly key: string
  readonly label: string
  readonly value: string
}

/** «Задача и текущий процесс»: процесс, объём, исполнители и текущие расходы (PRD 11.6, раздел 2). */
export function taskRows(ctx: ReportContext): readonly FactRow[] {
  const k = t.task.rows
  const { facts, economics } = ctx
  const staff = facts?.staff
  const rows: (FactRow | null)[] = [
    { key: 'process', label: k.process, value: facts?.name ?? '—' },
    { key: 'location', label: k.location, value: ctx.location.name },
    { key: 'volume', label: k.volume, value: facts?.volume ?? '—' },
    { key: 'schedule', label: k.schedule, value: facts?.shiftsText ?? '—' },
    { key: 'peak', label: k.peak, value: facts?.peakFactor == null ? '—' : formatNumber(facts.peakFactor, 2) },
    { key: 'staff', label: k.staff, value: staff?.headcount ? t.task.staff(formatCount(staff.headcount, ru.plural.people), staff.role) : '—' },
    staff?.salaryRub ? { key: 'salary', label: k.salary, value: t.task.perMonth(money(staff.salaryRub)) } : null,
    { key: 'opex', label: k.opex, value: money(economics.current.opexRubPerYear) },
    { key: 'operation', label: k.operation, value: operationRub(economics.current.opexRubPerYear, economics.operationsPerDay) },
    { key: 'tco', label: k.tco(ctx.horizon), value: money(economics.current.tcoRub) },
  ]
  return rows.filter((row): row is FactRow => row !== null)
}

export interface ApplicabilityRow {
  readonly key: string
  readonly label: string
  readonly requirement: string
  readonly status: CheckStatus
  readonly note: string
}

/**
 * Матрица применимости (PRD 11.6, раздел 5). Проверки решения из расчёта — как есть; расчёт их не прислал —
 * вариант рейтинга прошёл все применимые жёсткие условия отбора, а непроверенные условия площадки, от которых
 * зависит вывод, остаются «нет данных».
 */
export function applicabilityRows(ctx: ReportContext): readonly ApplicabilityRow[] {
  const c = t.config
  const { variant } = ctx
  if (!variant) return []
  if (variant.checks.length > 0) {
    return variant.checks.map((check) => ({ key: check.code, label: check.label, requirement: '—', status: check.status, note: check.message ?? '—' }))
  }
  if (variant.status === 'manual') return []
  const filters = ctx.matching.conditions.filter((m) => m.applicable).map((m): ApplicabilityRow => ({
    key: m.code, label: m.label, requirement: conditionValue(m) || '—', status: 'pass', note: c.passedFilter,
  }))
  const site = ctx.conditions.filter((row) => row.blocksConclusion && row.status !== 'confirmed').map((row): ApplicabilityRow => ({
    key: `site:${row.parameter}`, label: row.parameter, requirement: row.value, status: 'unknown', note: c.siteCheck(row.howToConfirm),
  }))
  return [...filters, ...site]
}
