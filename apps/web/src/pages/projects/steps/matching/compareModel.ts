import type { CompareCell, CompareCellTone, CompareGroup } from '@/components/ui/CompareTable'
import {
  needsCheckCount,
  siteRequirementChecks,
  type Characteristic,
  type MatchBaseline,
  type RankedVariant,
  type Robot,
  type RobotCharacteristicKey,
  type SiteFacts,
  type SolutionCheck,
} from '@/domain'
import { robotCharacteristics, summarize, type CharacteristicContext } from '@/pages/catalog/characteristics'
import { formatCount, formatNumber, formatPercent, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { rubMillions } from './matchingModel'

const t = ru.project.matching.compare
const plural = ru.project.matching.plural

/** Колонка сравнения: вариант рейтинга или решение, добавленное вручную (вне рейтинга, без расчёта). */
export interface CompareEntry {
  readonly key: string
  readonly name: string
  readonly variant: RankedVariant | null
  readonly robot: Robot | null
  /** Непройденные условия у добавленного вручную; null — вариант из рейтинга. */
  readonly violations: readonly SolutionCheck[] | null
}

export interface CompareContext {
  /** Справочники характеристик К-4 — те же значения и статусы, что на странице решения и в сравнении К-3. */
  readonly characteristics: CharacteristicContext
  readonly baseline: MatchBaseline | null
  readonly horizonYears: number
  /** Площадка проекта (шаг 1) и норматив запаса по ширине — для «Требует проверки» (D-99). */
  readonly site: SiteFacts
  readonly widthMarginM: number
}

interface Value {
  readonly content: string
  readonly tone: CompareCellTone
}

type Row = readonly [key: string, label: string, value: (e: CompareEntry) => Value]

const plain = (content: string | null, tone: CompareCellTone = 'default'): Value =>
  (content === null ? { content: t.noData, tone: 'unconfirmed' } : { content, tone })

/** Характеристика К-4 → ячейка: подтверждено — обычным цветом, оценка и нет данных — серым (как в К-3, D-64, D-76). */
const fromCharacteristic = (c: Characteristic): Value =>
  (c.status === 'missing' || c.value === null ? plain(null) : plain(c.value, c.status === 'confirmed' ? 'default' : 'unconfirmed'))

/** У решения вне рейтинга расчёта нет — «не рассчитано», а не «нет данных». */
const calc = (pick: (v: RankedVariant) => string | null) => (e: CompareEntry): Value =>
  (e.variant === null ? plain(t.notCalculated, 'unconfirmed') : plain(pick(e.variant)))

/** Нарушенное условие отбора у добавленного вручную — красная ячейка (FitCell К-3, `misfit`). */
const VIOLATION_ROWS: Readonly<Record<string, readonly string[]>> = {
  payload: ['payload'],
  dimensions: ['aisle_width'],
  conditions: ['environment', 'min_temperature', 'handling', 'work_type'],
}
const withViolation = (key: string, value: Value, e: CompareEntry): Value =>
  (e.violations?.some((v) => VIOLATION_ROWS[key]?.includes(v.code)) ? { ...value, tone: 'misfit' } : value)

function economics(ctx: CompareContext): readonly Row[] {
  const r = t.rows
  const years = formatCount(ctx.horizonYears, plural.years)
  const aux = (v: RankedVariant): string | null => {
    const parts = [
      v.stations === null ? null : formatCount(v.stations, plural.stations),
      v.auxEquipment?.wifiPoints == null ? null : formatCount(v.auxEquipment.wifiPoints, plural.wifiPoints),
    ].filter((p): p is string => p !== null)
    return parts.length === 0 ? null : parts.join(' · ')
  }
  const opexChange = (v: RankedVariant): string | null => {
    if (!ctx.baseline) return null
    const delta = v.opexRubPerYear - ctx.baseline.opexRubPerYear
    return t.perYear(`${delta < 0 ? '−' : '+'}${rubMillions(Math.abs(delta))}`)
  }
  return [
    ['robots', r.robots, calc((v) => formatNumber(v.robots))],
    ['aux', r.aux, calc(aux)],
    ['capex', r.capex, calc((v) => rubMillions(v.capexRub))],
    ['raas', r.raas, calc((v) => (v.acquisition === 'raas' ? rubMillions(v.raasMonthlyRub, 2) : '—'))],
    ['opex', r.opex, calc((v) => rubMillions(v.opexRubPerYear))],
    ['opexChange', r.opexChange, calc(opexChange)],
    ['labor', r.labor, calc((v) => (v.laborSavingsRubPerYear === null ? null : rubMillions(v.laborSavingsRubPerYear)))],
    ['effect', r.effect, (e) => {
      const value = calc((v) => rubMillions(v.annualEffectRub))(e)
      return (e.variant?.annualEffectRub ?? 0) < 0 ? { ...value, tone: 'misfit' } : value
    }],
    ['payback', r.payback, calc((v) => (v.paybackYears === null ? ru.project.matching.ranking.notPaying : formatYears(v.paybackYears)))],
    ['roi', r.roi(years), calc((v) => (v.roi === null ? null : formatPercent(v.roi)))],
    ['tco', r.tco(years), calc((v) => (v.tcoRub === null ? null : rubMillions(v.tcoRub)))],
  ]
}

function technical(ctx: CompareContext): readonly Row[] {
  const r = t.rows
  const char = (key: RobotCharacteristicKey) => (e: CompareEntry): Value =>
    (e.robot ? fromCharacteristic(robotCharacteristics(e.robot, ctx.characteristics)[key]) : plain(null))
  const mass = (e: CompareEntry): Value => {
    const kg = e.robot?.specs.massKg
    if (!e.robot || kg === undefined) return plain(null)
    return plain(`${formatNumber(kg)} ${ru.units.kg}`, e.robot.specs.confidence === 'confirmed' ? 'default' : 'unconfirmed')
  }
  const effective = calc((v) => (v.effectiveProductivity ? t.trips(formatNumber(v.effectiveProductivity.tripsPerHour, 1)) : null))
  const rows: readonly Row[] = [
    ['payload', r.payload, char('payload')],
    ['mass', r.mass, mass],
    ['dimensions', r.dimensions, char('dimensions')],
    ['speed', r.speed, char('speed')],
    ['productivity', r.productivity, char('productivity')],
    ['effective', r.effective, effective],
    ['autonomy', r.autonomy, char('autonomy')],
    ['accuracy', r.accuracy, char('positioningAccuracy')],
    ['navigation', r.navigation, char('navigation')],
    ['conditions', r.conditions, char('operatingConditions')],
  ]
  return rows.map(([key, label, value]) => [key, label, (e: CompareEntry) => withViolation(key, value(e), e)])
}

function data(ctx: CompareContext): readonly Row[] {
  const r = t.rows
  // Требования площадки — одно правило с «Недостающими данными» и правой колонкой 2.1 (D-99); тоны — ячейки соответствия К-3.
  const siteChecks = (e: CompareEntry): Value => {
    if (!e.robot) return plain(null)
    const checks = siteRequirementChecks(e.robot.specs, ctx.site, ctx.widthMarginM)
    const open = needsCheckCount(checks)
    const tone: CompareCellTone = checks.some((c) => c.status === 'misfit') ? 'misfit' : open > 0 ? 'unknown' : 'fit'
    return { content: t.needsCheck(open, checks.length), tone }
  }
  const completeness = (e: CompareEntry): Value => {
    if (!e.robot) return plain(null)
    const { filled, total } = summarize(robotCharacteristics(e.robot, ctx.characteristics))
    return plain(t.completenessValue(formatPercent(filled / total)))
  }
  return [
    ['siteChecks', r.siteChecks, siteChecks],
    ['completeness', r.completeness, completeness],
    ['availability', r.availability, (e) => (e.robot ? fromCharacteristic(robotCharacteristics(e.robot, ctx.characteristics).availability) : plain(null))],
  ]
}

/** Группы окна 2.1б (16833:474; PRD 11.3): экономика 11 строк, техника 10, инфраструктура и данные 3. */
export function compareGroups(entries: readonly CompareEntry[], ctx: CompareContext): readonly CompareGroup[] {
  const groups = { economics: economics(ctx), technical: technical(ctx), data: data(ctx) }
  return (Object.keys(groups) as (keyof typeof groups)[]).map((group) => ({
    key: group,
    title: t.groups[group],
    rows: groups[group].map(([key, label, value]) => ({
      key,
      label,
      cells: entries.map((e): CompareCell => ({ key: e.key, ...value(e) })),
    })),
  }))
}
