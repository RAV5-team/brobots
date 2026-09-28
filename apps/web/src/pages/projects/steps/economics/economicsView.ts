import {
  conclusion,
  newCostItems,
  operationCostRub,
  type AcquisitionModel,
  type Conclusion,
  type ConditionRow,
  type EconomicsResult,
  type ParamsProcessEntry,
  type Project,
  type ProjectParamsSnapshot,
  type ScenarioEconomics,
  type SimulationOutcome,
  type SimulationRun,
} from '@/domain'
import { staffing, type Staffing } from '@/pages/processes/locationStaffing'
import { formatCount, formatNumber, formatPercent, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { defaultsOf, locationNumber } from '../params/paramsModel'

const t = ru.project.economics
const plural = ru.plural
const YEARS = ru.project.matching.plural.years

const MILLION = 1_000_000

/** Суммы итога — миллионы с одним знаком: «6,1 млн ₽», «42,0 млн ₽» в колонках таблиц; меньше миллиона — «400 тыс. ₽». */
export const money = (value: number | null): string => {
  if (value === null) return '—'
  return Math.abs(value) >= MILLION ? formatRubCompact(value, { fractionDigits: 1, fixed: true }) : formatRubCompact(value)
}
export const years = (value: number | null): string => (value === null ? t.tiles.notPaying : formatYears(value))
export const acquisitionName = (acquisition: AcquisitionModel): string => ru.project.matching.acquisition[acquisition]

/** Выбранный сценарий проекта: уходит в снимок оценки, A1 и отчёт (PRD 11.5); по умолчанию — выбор подбора, затем RaaS. */
export const selectedAcquisition = (project: Project): AcquisitionModel =>
  project.inputs.economics?.scenario ?? project.inputs.matching?.selection?.acquisition ?? 'raas'

/** Способ приобретения из адреса `?scenario=`; иначе — null. */
export function parseAcquisition(value: string | null): AcquisitionModel | null {
  return value === 'raas' || value === 'purchase' ? value : null
}

export function scenarioOf(economics: EconomicsResult, acquisition: AcquisitionModel): ScenarioEconomics | null {
  return economics.scenarios.find((s) => s.acquisition === acquisition) ?? null
}

/**
 * Сценарий на экране. У сохранённой оценки выбранный сценарий показывает снимок (D-17, D-81): те же числа, что в списке A1,
 * даже если расчёт подбора потом изменится.
 */
export function shownScenario(economics: EconomicsResult, project: Project, acquisition: AcquisitionModel): ScenarioEconomics | null {
  const scenario = scenarioOf(economics, acquisition)
  if (!scenario || project.status !== 'saved' || project.inputs.economics?.scenario !== acquisition) return scenario
  const { result } = project
  return {
    ...scenario,
    capexRub: result.capexRub,
    opexRubPerYear: result.opexRubPerYear,
    paybackYears: result.paybackYears,
    annualEffectRub: result.annualEffectRub ?? scenario.annualEffectRub,
  }
}

/** Процесс проекта на площадке: объём, пик, режим, исполнители (из снимка шага 1). */
export interface ProcessFacts {
  readonly name: string
  /** «2 000 паллет». */
  readonly volume: string
  readonly volumePerDay: number
  readonly peakFactor: number | null
  /** «2 смены × 11 ч». */
  readonly shiftsText: string | null
  readonly hoursPerDay: number
  readonly staff: Staffing | null
  readonly missingCount: number
}

export function processFacts(snapshot: ProjectParamsSnapshot, project: Project, missingCount: (entry: ParamsProcessEntry) => number): ProcessFacts | null {
  const entry = snapshot.processes.find((p) => p.locationProcess.id === project.locationProcessId)
  if (!entry) return null
  const defaults = defaultsOf(entry)
  const shifts = locationNumber(snapshot, 'wh_shifts')
  const shiftHours = locationNumber(snapshot, 'wh_shift_hours')
  return {
    name: entry.locationProcess.name ?? entry.process.name,
    volume: `${formatNumber(defaults.dailyVolume)} ${entry.process.volumeUnit}`,
    volumePerDay: defaults.dailyVolume,
    peakFactor: defaults.peakFactor ?? null,
    shiftsText: shifts !== null && shiftHours !== null ? ru.location.shifts(formatCount(shifts, plural.shifts), formatNumber(shiftHours)) : null,
    hoursPerDay: shifts !== null && shiftHours !== null ? shifts * shiftHours : defaults.workHoursPerDay,
    staff: staffing(entry.process, entry.locationProcess, snapshot.location, snapshot.facilityParameters),
    missingCount: missingCount(entry),
  }
}

/** Чем закончилась проверка состава для вывода (PRD 11.5). */
export function simulationOutcome(project: Project, run: SimulationRun | null): SimulationOutcome {
  if (!project.inputs.simulation?.runId || !run) return 'none'
  return project.inputs.simulation.acceptRisk ? 'risk_accepted' : 'passed'
}

/** Условия реестра, которые относятся к сценарию: тариф RaaS у покупки не показывается. */
export const conditionsFor = (conditions: readonly ConditionRow[], acquisition: AcquisitionModel): readonly ConditionRow[] =>
  conditions.filter((c) => c.acquisition === null || c.acquisition === acquisition)

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)

export interface ConclusionView {
  readonly kind: Conclusion
  readonly title: string
  readonly explanation: string
  readonly nextStep: string
}

/** Вывод, пояснение и следующий шаг (PRD 11.5): не строится на пороге окупаемости. */
export function conclusionView(scenario: ScenarioEconomics, conditions: readonly ConditionRow[], outcome: SimulationOutcome, run: SimulationRun | null): ConclusionView {
  const blocking = conditions.filter((c) => c.blocksConclusion && c.status !== 'confirmed')
  const kind = conclusion({ annualEffectRub: scenario.annualEffectRub, uncheckedConditions: blocking.length, simulation: outcome })
  const effect = money(scenario.annualEffectRub)
  const base = { kind, title: t.conclusions[kind] }
  if (kind === 'preliminary') return { ...base, explanation: t.explain.preliminary, nextStep: t.next.pilot }
  if (kind === 'conditional') {
    return outcome === 'none'
      ? { ...base, explanation: t.explain.noSimulation(effect), nextStep: t.next.simulate }
      : { ...base, explanation: t.explain.conditional(effect, blocking.map((c) => lowerFirst(c.parameter)).join(', ')), nextStep: t.next.survey }
  }
  // Ветка «с риском»: числа — из итогов проверенного состава, как на вердикте (PRD 15 · №118).
  if (outcome === 'risk_accepted' && run) {
    const { requiredPerHour, servedPerHour } = run.before.peak
    const explanation = t.explain.deficit(formatNumber(servedPerHour), formatNumber(requiredPerHour), formatNumber(requiredPerHour - servedPerHour))
    return { ...base, explanation, nextStep: t.next.revise }
  }
  return { ...base, explanation: t.explain.negative(effect), nextStep: t.next.revise }
}

export interface Tile {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly caption: string
}

/** Пять показателей (PRD 11.5). У покупки платежа RaaS нет — вторая плитка показывает новые расходы (D-106). */
export function tiles(scenario: ScenarioEconomics, economics: EconomicsResult): readonly Tile[] {
  const robots = formatCount(scenario.robots, plural.robots)
  const second: Tile = scenario.raasMonthlyRub === null
    ? {
      key: 'new',
      label: t.tiles.newCosts,
      value: money(newCostItems(scenario).reduce((sum, item) => sum + item.amountRub, 0)),
      caption: t.tiles.newCostsCaption(newCostItems(scenario).map((item) => lowerFirst(item.label)).join(', ')),
    }
    : {
      key: 'raas',
      label: t.tiles.raas,
      value: t.tiles.raasValue(formatRubCompact(scenario.raasMonthlyRub)),
      caption: t.tiles.raasCaption(robots, money(scenario.raasMonthlyRub * 12)),
    }
  return [
    { key: 'capex', label: t.tiles.capex, value: money(scenario.capexRub), caption: t.tiles.capexCaption[scenario.acquisition] },
    second,
    { key: 'opex', label: t.tiles.opex, value: money(scenario.opexRubPerYear), caption: t.tiles.opexCaption(money(economics.current.opexRubPerYear)) },
    { key: 'effect', label: t.tiles.effect, value: money(scenario.annualEffectRub), caption: t.tiles.effectCaption },
    { key: 'payback', label: t.tiles.payback, value: years(scenario.paybackYears), caption: t.tiles.paybackCaption },
  ]
}

const operationRub = (opex: number, perDay: number): string => `${formatNumber(operationCostRub(opex, perDay), 1, { fixed: true })}\u00a0₽`

/** «Стоимость операции: 57,5 ₽ (сейчас 70,1 ₽) · ROI за 5 лет: 654 % · TCO за 5 лет: 216,1 млн ₽». */
export function summaryLine(scenario: ScenarioEconomics, economics: EconomicsResult): string {
  const horizon = formatCount(economics.horizonYears, YEARS)
  return t.tiles.summary(
    operationRub(scenario.opexRubPerYear, economics.operationsPerDay),
    operationRub(economics.current.opexRubPerYear, economics.operationsPerDay),
    horizon,
    scenario.roi === null ? '—' : formatPercent(scenario.roi),
    money(scenario.tcoRub),
  )
}

/** «18 роботов · 6 станций». */
export function fleetText(robots: number, stations: number | null): string {
  const r = formatCount(robots, plural.robots)
  return stations === null ? r : `${r} · ${formatCount(stations, plural.stations)}`
}

export { operationRub }
