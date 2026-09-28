import type { CompareCell, CompareCellTone, CompareGroup } from '@/components/ui/CompareTable'
import type { HandlingMethod, RankedVariant, Robot, SolutionCheck } from '@/domain'
import { specsCompleteness } from '@/domain'
import { formatCount, formatNumber, formatPercent, formatRubTenth, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { formatScore } from './matchingModel'

const t = ru.project.matching.compare

/** Колонка сравнения: вариант рейтинга или решение, добавленное вручную (вне рейтинга, без расчёта). */
export interface CompareEntry {
  readonly key: string
  readonly name: string
  readonly variant: RankedVariant | null
  readonly robot: Robot | null
  /** Непройденные условия у добавленного вручную; null — вариант из рейтинга. */
  readonly violations: readonly SolutionCheck[] | null
}

interface Context {
  readonly handlingMethods: readonly HandlingMethod[]
  /** Требования площадки без данных (шаг 1): одни для всех вариантов этой локации. */
  readonly siteUnchecked: number
}

type Row = readonly [key: string, label: string, value: (e: CompareEntry) => string | null, tone?: (e: CompareEntry) => CompareCellTone]

const money = (value: number | null | undefined): string | null => (value == null ? null : formatRubTenth(value))
const years = (value: number | null): string => (value === null ? ru.project.matching.ranking.notPaying : formatYears(value))

/** У решения вне рейтинга расчёта нет — «не рассчитано», а не «нет данных». */
const calc = (pick: (v: RankedVariant) => string | null) => (e: CompareEntry): string | null =>
  e.variant === null ? t.notCalculated : pick(e.variant)

function environment(robot: Robot): string | null {
  const { indoor, outdoor } = robot.specs
  if (indoor && outdoor) return t.both
  if (indoor) return t.indoor
  if (outdoor) return t.outdoor
  return null
}

function temperature(robot: Robot): string | null {
  const { minTempC, maxTempC } = robot.specs
  const c = ru.catalog.comparePage
  const degrees = (value: number) => formatNumber(value, 0, { signed: true })
  if (minTempC !== undefined && maxTempC !== undefined) return c.temperatureRange(degrees(minTempC), degrees(maxTempC))
  if (minTempC !== undefined) return c.temperatureFrom(degrees(minTempC))
  if (maxTempC !== undefined) return c.temperatureTo(degrees(maxTempC))
  return null
}

function dimensions(robot: Robot): string | null {
  const { lengthMm, widthMm, heightMm } = robot.specs
  if (lengthMm === undefined || widthMm === undefined || heightMm === undefined) return null
  return `${[lengthMm, widthMm, heightMm].map((n) => formatNumber(n)).join(' × ')} мм`
}

const spec = (pick: (r: Robot) => string | null) => (e: CompareEntry): string | null => (e.robot ? pick(e.robot) : null)

const violationTone = (code: SolutionCheck['code']) => (e: CompareEntry): CompareCellTone =>
  e.violations?.some((v) => v.code === code) ? 'misfit' : 'default'

function rows(ctx: Context): Readonly<Record<'economics' | 'technical' | 'data', readonly Row[]>> {
  const r = t.rows
  return {
    economics: [
      ['rank', r.rank, (e) => (e.variant?.rank == null || e.variant.score === null ? t.outOfRanking : t.rankValue(e.variant.rank, formatScore(e.variant.score)))],
      ['robots', r.robots, calc((v) => formatNumber(v.robots))],
      ['stations', r.stations, calc((v) => (v.stations === null ? null : formatNumber(v.stations)))],
      ['capex', r.capex, calc((v) => money(v.capexRub))],
      ['raas', r.raas, calc((v) => (v.acquisition === 'raas' ? money(v.raasMonthlyRub) : '—'))],
      ['opex', r.opex, calc((v) => money(v.opexRubPerYear))],
      ['effect', r.effect, calc((v) => money(v.annualEffectRub)), (e) => ((e.variant?.annualEffectRub ?? 0) < 0 ? 'misfit' : 'default')],
      ['labor', r.labor, calc((v) => money(v.laborSavingsRubPerYear))],
      ['payback', r.payback, calc((v) => years(v.paybackYears))],
      ['roi', r.roi, calc((v) => (v.roi === null ? null : formatPercent(v.roi)))],
      ['tco', r.tco, calc((v) => money(v.tcoRub))],
    ],
    technical: [
      ['payload', r.payload, spec((x) => (x.specs.payloadKg === undefined ? null : `${formatNumber(x.specs.payloadKg)} кг`)), violationTone('payload')],
      ['dimensions', r.dimensions, spec(dimensions), violationTone('aisle_width')],
      ['speed', r.speed, spec((x) => (x.specs.maxSpeedMps === undefined ? null : `${formatNumber(x.specs.maxSpeedMps, 2)} м/с`))],
      ['autonomy', r.autonomy, spec((x) => (x.specs.autonomyH === undefined ? null : `${formatNumber(x.specs.autonomyH)} ч`))],
      ['handling', r.handling, spec((x) => ctx.handlingMethods.find((h) => h.code === x.specs.handlingMethod)?.name ?? null), violationTone('handling')],
      ['environment', r.environment, spec(environment), violationTone('environment')],
      ['temperature', r.temperature, spec(temperature), violationTone('min_temperature')],
      ['readiness', r.readiness, spec((x) => ru.catalog.item.readiness[x.readiness])],
      ['trl', r.trl, spec((x) => (x.trl === null ? null : String(x.trl)))],
    ],
    data: [
      ['siteChecks', r.siteChecks, () => (ctx.siteUnchecked === 0 ? t.siteChecked : t.siteUnchecked(formatCount(ctx.siteUnchecked, ru.plural.parameters))), () => (ctx.siteUnchecked === 0 ? 'fit' : 'unknown')],
      ['completeness', r.completeness, spec((x) => formatPercent(specsCompleteness(x.specs)))],
      ['confidence', r.confidence, spec((x) => ru.catalog.comparePage.confidence[x.specs.confidence])],
    ],
  }
}

/** Группы сравнения (PRD 11.3): экономика, техника, инфраструктура и данные. Нарушенное условие — красная ячейка. */
export function compareGroups(entries: readonly CompareEntry[], ctx: Context): readonly CompareGroup[] {
  const groups = rows(ctx)
  return (Object.keys(groups) as (keyof typeof groups)[]).map((group) => ({
    key: group,
    title: t.groups[group],
    rows: groups[group].map(([key, label, value, tone]) => ({
      key,
      label,
      cells: entries.map((e): CompareCell => ({ key: e.key, tone: tone?.(e) ?? 'default', content: value(e) ?? t.noData })),
    })),
  }))
}
