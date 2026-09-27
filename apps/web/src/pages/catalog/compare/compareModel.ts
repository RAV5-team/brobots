import {
  type Characteristic,
  type CompareEntry,
  type LaunchItem,
  type Location,
  type Robot,
  type RobotCharacteristicKey,
} from '@/domain'
import { formatRubMillions } from '@/shared/format/money'
import { formatNumber, formatPercent } from '@/shared/format/number'
import { ru } from '@/shared/i18n/ru'
import type { CatalogEntry } from '../catalogModel'
import { robotCharacteristics, summarize, type CharacteristicContext } from '../characteristics'
import { COMPARE_LAUNCH_LABELS, launchLabels } from '../launchLabels'

const t = ru.catalog.comparePage

/** Значение ячейки: текст или ряд плашек; тон — как в CompareTable. */
export type CompareValue =
  | { readonly kind: 'text'; readonly text: string; readonly tone: 'default' | 'unconfirmed' }
  | { readonly kind: 'chips'; readonly items: readonly string[]; readonly tone: 'default' | 'unconfirmed' | 'panel' }
  | { readonly kind: 'fit'; readonly text: string; readonly status: 'fit' | 'misfit' | 'unknown' }

export interface CompareModelRow {
  readonly key: string
  readonly label: string
  readonly values: readonly CompareValue[]
}

export interface CompareModelGroup {
  readonly key: string
  readonly title: string
  readonly rows: readonly CompareModelRow[]
}

const text = (value: string, tone: 'default' | 'unconfirmed' = 'default'): CompareValue => ({ kind: 'text', text: value, tone })
const NOT_APPLICABLE = text(t.notApplicable)
const NO_DATA = text(t.noData, 'unconfirmed')

/** Значение характеристики: подтверждено — обычным цветом, оценка — серым, нет данных — «нет данных» (D-64, D-76). */
function fromCharacteristic(c: Characteristic): CompareValue {
  if (c.status === 'missing' || c.value === null) return NO_DATA
  return text(c.value, c.status === 'confirmed' ? 'default' : 'unconfirmed')
}

/** Запас по ширине прохода: ширина робота + 0,6 м ≤ проход — правило карточки робота А2 (PRD 6.3, D-75). */
export const AISLE_CLEARANCE_M = 0.6
const MM_IN_M = 1000
const PALLET_MASS = 'wh_pallet_mass'
const RACK_AISLE = 'wh_rack_aisle_width'

const numericParameter = (location: Location, code: string): number | null => {
  const value = location.parameters[code]?.value
  return typeof value === 'number' ? value : null
}

/**
 * Проверка площадки для блока «Соответствие» (PRD 7.6 — та же, что в подборе): груз — масса паллеты против
 * грузоподъёмности, проходы — ширина робота против прохода с запасом. Температуры и допустимой нагрузки на пол
 * в профиле склада нет — «?» (D-75).
 */
export function siteFit(robot: Robot, location: Location): Record<'cargo' | 'aisles' | 'temperature' | 'floorLoad', CompareValue> {
  const mass = numericParameter(location, PALLET_MASS)
  const payload = robot.specs.payloadKg
  const cargo: CompareValue = mass === null || payload === undefined
    ? { kind: 'fit', status: 'unknown', text: t.fit.cargoUnknown }
    : mass <= payload
      ? { kind: 'fit', status: 'fit', text: t.fit.cargoOk(formatNumber(mass), formatNumber(payload)) }
      : { kind: 'fit', status: 'misfit', text: t.fit.cargoTooHeavy(formatNumber(mass), formatNumber(payload)) }

  const aisle = numericParameter(location, RACK_AISLE)
  const width = robot.specs.widthMm === undefined ? null : robot.specs.widthMm / MM_IN_M
  const aisles: CompareValue = aisle === null || width === null
    ? { kind: 'fit', status: 'unknown', text: t.fit.aisleUnknown }
    : width <= aisle - AISLE_CLEARANCE_M
      ? { kind: 'fit', status: 'fit', text: t.fit.aisleOk(formatNumber(aisle, 1), formatNumber(width, 2)) }
      : { kind: 'fit', status: 'misfit', text: t.fit.aisleTooNarrow(formatNumber(aisle, 1), formatNumber(width, 2)) }

  return {
    cargo,
    aisles,
    temperature: { kind: 'fit', status: 'unknown', text: t.fit.temperatureUnknown },
    floorLoad: { kind: 'fit', status: 'unknown', text: t.fit.floorLoadUnknown },
  }
}

interface ModelContext extends CharacteristicContext {
  readonly items: readonly LaunchItem[]
  readonly robots: readonly Robot[]
  /** Локация блока «Соответствие»; нет — блока нет (D-58). */
  readonly location: Location | null
}

type RowSpec = readonly [key: string, label: string, robot: (r: Robot, ctx: ModelContext) => CompareValue, item: (i: LaunchItem, ctx: ModelContext) => CompareValue]

const compatibleNames = (item: LaunchItem, ctx: ModelContext): readonly string[] =>
  item.compatibleWith.map((ref) => {
    if (ref.kind === 'text') return ref.text
    const found = ref.kind === 'robot' ? ctx.robots.find((r) => r.id === ref.id) : ctx.items.find((i) => i.id === ref.id)
    return found?.name ?? ref.id
  })

const na = () => NOT_APPLICABLE

/** Строка из характеристики робота — те же значения и статусы, что на странице решения К-4 (D-76). */
const char = (key: RobotCharacteristicKey) => (r: Robot, ctx: ModelContext) => fromCharacteristic(robotCharacteristics(r, ctx)[key])

const MAIN: readonly RowSpec[] = [
  ['price', t.rows.price,
    (r) => (r.priceRub === null ? NO_DATA : text(formatRubMillions(r.priceRub))),
    (i) => text(i.price.kind === 'rub' ? formatRubMillions(i.price.amountRub) : ru.catalog.card.percentOfCapex(i.price.percent))],
  ['role', t.rows.role, () => text(t.role.robot), (i) => text(i.launchCategory ? t.role.required : t.role.optional)],
  ['trl', t.rows.trl, (r) => (r.trl === null ? NO_DATA : text(String(r.trl))), na],
  ['status', t.rows.status, (r) => (r.readiness === 'unknown' ? NO_DATA : text(t.status[r.readiness])), na],
  ['costType', t.rows.costType, () => text(ru.catalog.card.costType.capex), (i) => text(ru.catalog.card.costType[i.costType])],
  ['quantityNorm', t.rows.quantityNorm, na, (i) => text(i.quantityNorm)],
  ['solutionType', t.rows.solutionType, (r) => text(r.subtype), (i) => text(i.specs[0]?.value ?? t.noData, i.specs[0] ? 'default' : 'unconfirmed')],
  ['operationClasses', t.rows.operationClasses,
    (r) => (r.operationClasses.length === 0 ? text(t.noClass, 'unconfirmed') : { kind: 'chips', items: r.operationClasses.map((c) => c.code), tone: 'default' }),
    na],
  ['region', t.rows.region, (r) => (r.region ? text(r.region) : NO_DATA), na],
]

const PERFORMANCE: readonly RowSpec[] = [
  ['payload', t.rows.payload,
    (r, ctx) => {
      const value = fromCharacteristic(robotCharacteristics(r, ctx).payload)
      return value.kind === 'text' && value !== NO_DATA ? { kind: 'chips', items: [value.text], tone: value.tone } : value
    },
    na],
  ['productivity', t.rows.productivity, char('productivity'), na],
  ['autonomy', t.rows.autonomy, char('autonomy'), na],
]

const REQUIREMENTS: readonly RowSpec[] = [
  ['minAisle', t.rows.minAisle, char('aisleRequirements'), na],
  ['floor', t.rows.floor, char('floorRequirements'), na],
  ['temperature', t.rows.temperature, char('temperature'), na],
  ['connectivity', t.rows.connectivity, char('connectivity'), na],
  ['launchInfrastructure', t.rows.launchInfrastructure,
    (r, ctx) => ({ kind: 'chips', items: launchLabels(r.launchRequired, ctx.items, COMPARE_LAUNCH_LABELS), tone: 'panel' }),
    na],
  ['compatibility', t.rows.compatibility, na,
    (i, ctx) => (i.compatibleWith.length === 0 ? NO_DATA : text(compatibleNames(i, ctx).join(', ')))],
]

const QUALITY: readonly RowSpec[] = [
  // Полнота — по пяти группам К-4, подтверждено — ключевые ТТХ: у AMR 800 «90 %» и «7 из 8», как на К-3 (D-77).
  ['completeness', t.rows.completeness, (r, ctx) => {
    const { filled, total } = summarize(robotCharacteristics(r, ctx))
    return text(formatPercent(filled / total))
  }, na],
  ['confirmed', t.rows.confirmed,
    (r, ctx) => {
      const { keyConfirmed, keyTotal } = summarize(robotCharacteristics(r, ctx))
      return text(t.confirmedOf(keyConfirmed, keyTotal), keyConfirmed === keyTotal ? 'default' : 'unconfirmed')
    },
    (i) => {
      const confirmed = i.specs.filter((s) => s.status === 'confirmed').length
      return text(t.confirmedOf(confirmed, i.specs.length), confirmed === i.specs.length ? 'default' : 'unconfirmed')
    }],
]

function buildRows(specs: readonly RowSpec[], entries: readonly CatalogEntry[], ctx: ModelContext): readonly CompareModelRow[] {
  return specs.map(([key, label, robot, item]) => ({
    key,
    label,
    values: entries.map((e) => (e.kind === 'robot' ? robot(e.robot, ctx) : item(e.item, ctx))),
  }))
}

function fitGroup(entries: readonly CatalogEntry[], location: Location): CompareModelGroup {
  const fits = entries.map((e) => (e.kind === 'robot' ? siteFit(e.robot, location) : null))
  const row = (key: 'cargo' | 'aisles' | 'temperature' | 'floorLoad', label: string): CompareModelRow => ({
    key, label, values: fits.map((f) => f?.[key] ?? NOT_APPLICABLE),
  })
  return {
    key: 'fit',
    title: t.groups.fit(location.name),
    rows: [row('cargo', t.rows.cargo), row('aisles', t.rows.aisles), row('temperature', t.rows.temperatureMode), row('floorLoad', t.rows.floorLoad)],
  }
}

/** Группы строк сравнения по PRD 7.6; у позиции для запуска строки робота — «не применимо». */
export function buildCompareGroups(entries: readonly CatalogEntry[], ctx: ModelContext): readonly CompareModelGroup[] {
  const groups: CompareModelGroup[] = [
    { key: 'main', title: t.groups.main, rows: buildRows(MAIN, entries, ctx) },
    { key: 'performance', title: t.groups.performance, rows: buildRows(PERFORMANCE, entries, ctx) },
    { key: 'requirements', title: t.groups.requirements, rows: buildRows(REQUIREMENTS, entries, ctx) },
    { key: 'quality', title: t.groups.quality, rows: buildRows(QUALITY, entries, ctx) },
  ]
  return ctx.location ? [...groups, fitGroup(entries, ctx.location)] : groups
}

/** Позиции набора в порядке добавления; позиций, которых уже нет в каталоге, не показываем. */
export function resolveEntries(selected: readonly CompareEntry[], robots: readonly Robot[], items: readonly LaunchItem[]): readonly CatalogEntry[] {
  return selected.flatMap((ref): CatalogEntry[] => {
    if (ref.kind === 'robot') {
      const robot = robots.find((r) => r.id === ref.id)
      return robot ? [{ kind: 'robot', robot }] : []
    }
    const item = items.find((i) => i.id === ref.id)
    return item ? [{ kind: 'launch-item', item }] : []
  })
}
