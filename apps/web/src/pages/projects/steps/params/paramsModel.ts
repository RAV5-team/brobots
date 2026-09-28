import {
  paramsReadiness,
  type AssumptionOverride,
  type LocationProcessId,
  type MissingValue,
  type OperationClassCode,
  type ParameterValue,
  type ParamsProcessEntry,
  type ParamsReadiness,
  type ProjectParamsSnapshot,
  type SiteGroup,
  type ValueOrigin,
  type ValueSource,
} from '@/domain'
import { numberParameter, staffing, type Staffing } from '@/pages/processes/locationStaffing'
import { formatNumber, formatPercent, formatRub } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.params

/** Упаковка: маршрут не применяется (PRD 11.2, «Как отличаются другие процессы»; D-93). */
const NO_ROUTE_CLASSES: readonly OperationClassCode[] = ['OP-05']
/** Инвентаризация: без частоты пересчёта не посчитать парк — подбор недоступен (PRD 11.2). */
const INVENTORY_CLASS: OperationClassCode = 'OP-06'
/** Запас по ширине, когда в шаблоне процесса его нет: норматив модели прототипа (PRD 11.2; PRD 15 · №128). */
const DEFAULT_WIDTH_MARGIN_M = 0.5
const DAYS_PER_MONTH = 30

/** Строка значения: подпись, значение и статус; `anchor` — цель кнопки «↓» у незаполненного значения. */
export interface ValueRow {
  readonly key: string
  readonly label: string
  /** null — нет данных. */
  readonly value: string | null
  readonly origin: ValueOrigin
  readonly note?: string
  readonly anchor?: string
}

export interface RowGroup {
  readonly key: string
  readonly title: string
  readonly rows: readonly ValueRow[]
}

export interface SiteRow extends ValueRow {
  /** Показывается при фильтре «только применимые к процессу». */
  readonly applicable: boolean
}

export interface SiteRowGroup {
  readonly key: SiteGroup
  readonly title: string
  readonly rows: readonly SiteRow[]
}

export interface ProcessCard {
  readonly id: LocationProcessId
  readonly name: string
  readonly workers: string
  readonly volume: string
  readonly object: string | null
  readonly missing: readonly MissingItem[]
  readonly canMatch: boolean
}

export const ASSUMPTION_CODES = ['route_length_m', 'operator_time_share_pct', 'peak_factor', 'width_margin_m'] as const
export type AssumptionCode = (typeof ASSUMPTION_CODES)[number]

/** Допущение блока 3: исходное значение и уточнение пользователя (значения — в единицах экрана: м, %, коэф.). */
export interface AssumptionRow {
  readonly code: AssumptionCode
  readonly unit: string
  readonly base: number
  readonly min: number
  readonly max: number
  readonly digits: number
  readonly override: AssumptionOverride | null
  /** Действующее значение: уточнение или исходное. */
  readonly value: number
}

export interface MissingItem extends MissingValue {
  readonly label: string
}

export interface ParamsView {
  readonly cards: readonly ProcessCard[]
  readonly selected: ParamsProcessEntry | null
  readonly groups: readonly RowGroup[]
  readonly siteGroups: readonly SiteRowGroup[]
  readonly assumptions: readonly AssumptionRow[]
  readonly missing: readonly MissingItem[]
  readonly readiness: ParamsReadiness | null
}

/** Якорь строки значения на странице — цель «↓» в плашке незаполненных значений. */
export const valueAnchor = (code: string): string => `param-${code}`

const hasRoute = (entry: ParamsProcessEntry): boolean => !NO_ROUTE_CLASSES.includes(entry.process.operationClass)
const isInventory = (entry: ParamsProcessEntry): boolean => entry.process.operationClass === INVENTORY_CLASS

/** Значения шаблона с переопределениями площадки. */
export const defaultsOf = (entry: ParamsProcessEntry) => ({ ...entry.process.defaults, ...entry.locationProcess.overrides })

const staffOf = (entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot): Staffing | null =>
  staffing(entry.process, entry.locationProcess, snapshot.location, snapshot.facilityParameters)

export const locationNumber = (snapshot: ProjectParamsSnapshot, code: string): number | null =>
  numberParameter(snapshot.location, snapshot.facilityParameters, code)

/** Режим локации: смен × часов смены (РЦ Химки — 2 × 11 = 22 ч). */
function locationHours(snapshot: ProjectParamsSnapshot): number | null {
  const shifts = locationNumber(snapshot, 'wh_shifts')
  const hours = locationNumber(snapshot, 'wh_shift_hours')
  return shifts !== null && hours !== null ? shifts * hours : null
}

const ORIGIN_OF_SOURCE: Record<ValueSource, ValueOrigin> = { organizer: 'file', user: 'specified', assumption: 'assumption', computed: 'computed' }

/** Чего не хватает процессу до подбора (PRD 11.2): критичные значения процесса, исполнители и оклад, проверки площадки. */
export function missingOf(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot): readonly MissingValue[] {
  const staff = staffOf(entry, snapshot)
  const blocking: readonly MissingValue[] = isInventory(entry) && defaultsOf(entry).recountsPerMonth === undefined
    ? [{ code: 'recountsPerMonth', scope: 'process', impact: 'blocks' }]
    : []
  const labor: readonly MissingValue[] = staff?.headcount == null
    ? [{ code: 'workers', scope: 'process', impact: 'no_labor_saving' }]
    : staff.salaryRub === null ? [{ code: 'salary', scope: 'process', impact: 'no_labor_saving' }] : []
  const site = snapshot.siteParameters
    .filter((p) => p.checkedByMatching && (!p.routeOnly || hasRoute(entry)) && siteValue(snapshot, p.code) === undefined)
    .map((p): MissingValue => ({ code: p.code, scope: 'site', impact: 'needs_check' }))
  return [...blocking, ...labor, ...site]
}

/** Значение площадки: из снимка `site_*` или из профиля локации (коды датасета). */
const siteValue = (snapshot: ProjectParamsSnapshot, code: string): ParameterValue | undefined =>
  snapshot.siteValues[code] ?? snapshot.location.parameters[code]

export const missingLabel = (m: MissingValue, snapshot: ProjectParamsSnapshot): string =>
  t.missingLabels[m.code] ?? snapshot.siteParameters.find((p) => p.code === m.code)?.name.toLowerCase() ?? m.code

const labelled = (missing: readonly MissingValue[], snapshot: ProjectParamsSnapshot): readonly MissingItem[] =>
  missing.map((m) => ({ ...m, label: missingLabel(m, snapshot) }))

function volumeText(entry: ParamsProcessEntry): string {
  const volume = formatNumber(defaultsOf(entry).dailyVolume)
  return entry.process.volumePeriod === 'cycle' ? t.process.perCycle(volume, entry.process.volumeUnit) : t.process.perDay(volume, entry.process.volumeUnit)
}

function processCard(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot): ProcessCard {
  const staff = staffOf(entry, snapshot)
  const missing = labelled(missingOf(entry, snapshot), snapshot)
  const carrier = defaultsOf(entry).carrier
  return {
    id: entry.locationProcess.id,
    name: entry.locationProcess.name ?? entry.process.name,
    workers: staff?.headcount == null ? t.process.noWorkers : t.process.workers(formatNumber(staff.headcount), staff.role),
    volume: volumeText(entry),
    object: carrier ? t.process.object(carrier) : null,
    missing,
    canMatch: !missing.some((m) => m.impact === 'blocks'),
  }
}

/** Исходные значения допущений процесса; нет основы (нет маршрута или исполнителей) — допущения нет. */
function assumptionBases(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot): Partial<Record<AssumptionCode, number>> {
  const defaults = defaultsOf(entry)
  const staff = staffOf(entry, snapshot)
  const route = hasRoute(entry)
  return {
    ...(route && defaults.routeLengthM !== undefined ? { route_length_m: defaults.routeLengthM } : {}),
    ...(staff ? { operator_time_share_pct: staff.timeShare * 100 } : {}),
    peak_factor: locationNumber(snapshot, 'wh_peak_factor') ?? defaults.peakFactor ?? 1,
    ...(route ? { width_margin_m: entry.process.template?.widthMarginM ?? DEFAULT_WIDTH_MARGIN_M } : {}),
  }
}

const ASSUMPTION_LIMITS: Record<AssumptionCode, Pick<AssumptionRow, 'unit' | 'min' | 'max' | 'digits'>> = {
  route_length_m: { unit: 'м', min: 5, max: 5000, digits: 0 },
  operator_time_share_pct: { unit: '%', min: 1, max: 100, digits: 0 },
  peak_factor: { unit: 'коэф.', min: 1, max: 3, digits: 2 },
  width_margin_m: { unit: 'м', min: 0.1, max: 1.5, digits: 2 },
}

export function assumptionRows(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot, overrides: readonly AssumptionOverride[]): readonly AssumptionRow[] {
  const bases = assumptionBases(entry, snapshot)
  return ASSUMPTION_CODES.flatMap((code) => {
    const base = bases[code]
    if (base === undefined) return []
    const override = overrides.find((o) => o.code === code) ?? null
    return [{ code, ...ASSUMPTION_LIMITS[code], base, override, value: override?.value ?? base }]
  })
}

/** Статус значения, которое пользователь уточнил: факт — «указано», оценка — остаётся допущением. */
const refinedOrigin = (row: AssumptionRow | undefined, fallback: ValueOrigin): ValueOrigin => {
  if (!row?.override) return fallback
  return row.override.kind === 'fact' ? 'specified' : 'assumption'
}

/** Значение допущения с единицей: «100 м», «1,5», «95 %». */
export function assumptionValueText(row: Pick<AssumptionRow, 'unit' | 'digits'>, value: number): string {
  const number = formatNumber(value, row.digits)
  if (row.unit === 'коэф.') return number
  return row.unit === '%' ? `${number} %` : `${number} ${row.unit}`
}

const row = (key: string, label: string, value: string | null, origin: ValueOrigin, extra: Pick<ValueRow, 'note' | 'anchor'> = {}): ValueRow =>
  ({ key, label, value, origin, ...extra })

function objectGroup(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot): RowGroup {
  const d = defaultsOf(entry)
  const r = t.rows
  const handling = entry.locationProcess.handling ?? entry.process.handling
  const handlingNames = handling
    .map((h) => snapshot.handlingMethods.find((m) => m.code === h.method)?.name)
    .filter((name): name is string => name !== undefined)
  const kg = (value: number) => `${formatNumber(value)} кг`
  const rows: readonly (ValueRow | null)[] = [
    row('operationClass', r.operationClass, `${entry.process.operationClass} · ${entry.operationClass?.name ?? entry.process.name}`, 'specified'),
    d.carrier ? row('object', r.object, capitalize(d.carrier), 'specified') : null,
    handlingNames.length > 0 ? row('handling', r.handling, capitalize(handlingNames.join(', ').toLowerCase()), 'specified') : null,
    d.unitMassKg === undefined ? null
      : d.maxUnitMassKg === undefined ? row('mass', r.massAvg, kg(d.unitMassKg), 'specified')
        : row('mass', r.mass, `${kg(d.unitMassKg)} / ${kg(d.maxUnitMassKg)}`, 'specified'),
    d.unitDimensionsMm ? row('dimensions', r.dimensions, `${d.unitDimensionsMm.map((v) => formatNumber(v)).join(' × ')} мм`, 'specified') : null,
    d.cargoDivisible === undefined ? null : row('divisible', r.divisible, d.cargoDivisible ? r.divisibleYes : r.divisibleNo, 'specified'),
    isInventory(entry)
      ? d.recountsPerMonth === undefined
        ? row('recountsPerMonth', r.recounts, null, 'missing', { anchor: valueAnchor('recountsPerMonth'), note: t.process.fillInProcess })
        : row('recountsPerMonth', r.recounts, r.recountsValue(formatNumber(d.recountsPerMonth)), 'specified')
      : null,
  ]
  return { key: 'object', title: t.groups.object, rows: rows.filter((x): x is ValueRow => x !== null) }
}

/** Потребность в пик (PRD 11.2): объём в сутки ÷ часы × пик × доля к роботизации. */
export interface PeakDemand {
  /** Операций в сутки; у инвентаризации — объём цикла × пересчётов в месяц ÷ 30. */
  readonly perDay: number
  readonly hours: number
  readonly peakFactor: number
  readonly share: number
  /** Результат, единиц в час. */
  readonly perHour: number
  /** «паллет», «строк». */
  readonly unit: string
}

/** null — у инвентаризации не задана частота пересчёта. Шаг 1 и «Как рассчитано» (03a) считают одинаково. */
export function peakDemand(entry: ParamsProcessEntry, hours: number, peakFactor: number): PeakDemand | null {
  const d = defaultsOf(entry)
  const cycle = entry.process.volumePeriod === 'cycle'
  if (cycle && d.recountsPerMonth === undefined) return null
  const perDay = cycle ? d.dailyVolume * (d.recountsPerMonth ?? 0) / DAYS_PER_MONTH : d.dailyVolume
  return { perDay, hours, peakFactor, share: d.automationShare, perHour: perDay / hours * peakFactor * d.automationShare, unit: entry.process.volumeUnit }
}

/** «2 000 ÷ 22 ч × 1,5 × 95 %». */
export const peakDemandFormula = (p: PeakDemand): string =>
  `${formatNumber(p.perDay)} ÷ ${formatNumber(p.hours)} ч × ${formatNumber(p.peakFactor, 2)} × ${formatPercent(p.share)}`

/** Нагрузка в пик: объём ÷ часы × пик × доля (PRD 11.2); у инвентаризации объём — за цикл, нужна частота пересчёта. */
function peakLoadRow(entry: ParamsProcessEntry, hours: number, peak: number): ValueRow {
  const demand = peakDemand(entry, hours, peak)
  if (!demand) return row('peakLoad', t.rows.peakLoad, t.rows.peakLoadNoRecounts, 'missing')
  // Нагрузка уточнится симуляцией и подбором — до них она предварительная (PRD 11.2).
  return row('peakLoad', t.rows.peakLoad, t.rows.peakLoadValue(peakDemandFormula(demand), formatNumber(demand.perHour), demand.unit), 'preliminary')
}

function loadGroup(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot, assumptions: readonly AssumptionRow[]): RowGroup {
  const d = defaultsOf(entry)
  const r = t.rows
  const locHours = locationHours(snapshot)
  const ownSchedule = locHours === null || d.workHoursPerDay !== locHours
  const peakRow = assumptions.find((a) => a.code === 'peak_factor')
  const peak = peakRow?.value ?? 1
  const peakOrigin = refinedOrigin(peakRow, 'location')
  const staff = staffOf(entry, snapshot)
  const shiftHours = locationNumber(snapshot, 'wh_shift_hours')
  const productivity = staff?.headcount && shiftHours && entry.process.volumePeriod !== 'cycle'
    ? row('productivity', r.productivity, r.productivityValue(formatNumber(d.dailyVolume / staff.headcount / shiftHours, 1), entry.process.volumeUnit), 'computed', {
        note: r.productivityFormula(formatNumber(d.dailyVolume), formatNumber(staff.headcount), formatNumber(shiftHours)),
      })
    : null
  const rows: readonly (ValueRow | null)[] = [
    row('volume', r.volume, volumeText(entry), 'specified'),
    row('hours', r.hours, ownSchedule ? r.hoursOwn(formatNumber(d.workHoursPerDay)) : r.hoursLocation(formatNumber(d.workHoursPerDay)), ownSchedule ? 'specified' : 'location'),
    row('peak', r.peak, peakRow?.override ? formatNumber(peak, 2) : r.peakLocation(formatNumber(peak, 2)), peakOrigin),
    row('share', r.share, r.shareValue(formatPercent(d.automationShare), formatPercent(1 - d.automationShare)), 'specified'),
    productivity,
    peakLoadRow(entry, d.workHoursPerDay, peak),
  ]
  return { key: 'load', title: t.groups.load, rows: rows.filter((x): x is ValueRow => x !== null) }
}

function routeGroup(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot, assumptions: readonly AssumptionRow[]): RowGroup {
  const r = t.rows
  const points = defaultsOf(entry).routePoints ?? []
  const floors = locationNumber(snapshot, 'wh_floors')
  const lengthRow = assumptions.find((a) => a.code === 'route_length_m')
  const middle = points.slice(1, -1)
  const rows: readonly (ValueRow | null)[] = [
    points.length >= 2
      ? row('routeEnds', r.routeEnds, `${points[0] ?? ''} → ${points[points.length - 1] ?? ''}`, 'specified')
      : row('routeEnds', r.routeEnds, null, 'missing', { note: t.process.fillInProcess }),
    points.length >= 2
      ? row('routeMiddle', r.routeMiddle, r.routeMiddleValue(middle.length > 0 ? middle.join(', ') : r.none, floors !== null && floors > 1 ? r.liftYes : r.none), 'specified')
      : null,
    lengthRow ? row('routeLength', r.routeLength, assumptionValueText(lengthRow, lengthRow.value), refinedOrigin(lengthRow, 'assumption')) : null,
  ]
  return { key: 'route', title: t.groups.route, rows: rows.filter((x): x is ValueRow => x !== null) }
}

function workersGroup(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot, assumptions: readonly AssumptionRow[]): RowGroup {
  const r = t.rows
  const staff = staffOf(entry, snapshot)
  const shareRow = assumptions.find((a) => a.code === 'operator_time_share_pct')
  const value = (): ValueRow => {
    if (staff?.headcount == null) return row('workers', r.staff, r.staffNone, 'missing', { anchor: valueAnchor('workers'), note: t.process.fillInProcess })
    if (staff.salaryRub === null) {
      return row('salary', r.staff, r.staffNoSalary(formatNumber(staff.headcount), staff.role), 'missing', { anchor: valueAnchor('salary'), note: t.process.fillInProcess })
    }
    const share = shareRow ? `${formatNumber(shareRow.value)} %` : formatPercent(staff.timeShare)
    return row('workers', r.staff, r.staffValue(formatNumber(staff.headcount), staff.role, formatRub(staff.salaryRub), share), 'location')
  }
  return { key: 'workers', title: t.groups.workers, rows: [value()] }
}

/** Группы А–Г выбранного процесса (PRD 11.2); у процесса без маршрута группы «В» нет. */
export function processGroups(entry: ParamsProcessEntry, snapshot: ProjectParamsSnapshot, assumptions: readonly AssumptionRow[]): readonly RowGroup[] {
  return [
    objectGroup(entry, snapshot),
    loadGroup(entry, snapshot, assumptions),
    ...(hasRoute(entry) ? [routeGroup(entry, snapshot, assumptions)] : []),
    workersGroup(entry, snapshot, assumptions),
  ]
}

function siteValueText(snapshot: ProjectParamsSnapshot, code: string, pairCode: string | undefined, unit: string): string | null {
  const value = siteValue(snapshot, code)?.value
  if (value === undefined) return null
  if (pairCode !== undefined) {
    const pair = siteValue(snapshot, pairCode)?.value
    const signed = (v: number | string) => (typeof v === 'number' ? formatNumber(v, 1, { signed: true }) : v)
    return pair === undefined ? signed(value) : t.site.tempRange(signed(value), signed(pair))
  }
  if (typeof value === 'string') return value
  return unit ? `${formatNumber(value, 2)} ${unit}` : formatNumber(value, 2)
}

/** 25 параметров площадки по группам PRD 10.5 (D-92); «нет данных» — ссылка в профиль локации. */
export function siteGroups(snapshot: ProjectParamsSnapshot, entry: ParamsProcessEntry | null): readonly SiteRowGroup[] {
  const route = entry === null || hasRoute(entry)
  const groups = [...new Set(snapshot.siteParameters.map((p) => p.group))]
  return groups.map((group) => ({
    key: group,
    title: t.site.groups[group],
    rows: snapshot.siteParameters.filter((p) => p.group === group).map((p): SiteRow => {
      const value = siteValueText(snapshot, p.code, p.pairCode, p.unit)
      const source = siteValue(snapshot, p.code)?.source
      return {
        key: p.code,
        label: p.name,
        value,
        origin: value === null || source === undefined ? 'missing' : ORIGIN_OF_SOURCE[source],
        applicable: !p.routeOnly || route,
        ...(value === null ? { anchor: valueAnchor(p.code), note: t.site.fillInProfile } : {}),
      }
    }),
  }))
}

/** Всё содержимое шага для выбранного процесса и уточнённых допущений. */
export function paramsView(snapshot: ProjectParamsSnapshot, selectedId: LocationProcessId | null, overrides: readonly AssumptionOverride[]): ParamsView {
  const selected = snapshot.processes.find((p) => p.locationProcess.id === selectedId) ?? null
  const cards = snapshot.processes.map((p) => processCard(p, snapshot))
  if (!selected) return { cards, selected, groups: [], siteGroups: siteGroups(snapshot, null), assumptions: [], missing: [], readiness: null }
  const assumptions = assumptionRows(selected, snapshot, overrides)
  const missing = labelled(missingOf(selected, snapshot), snapshot)
  const assumptionsCount = assumptions.filter((a) => a.override?.kind !== 'fact').length
  return {
    cards,
    selected,
    groups: processGroups(selected, snapshot, assumptions),
    siteGroups: siteGroups(snapshot, selected),
    assumptions,
    missing,
    readiness: paramsReadiness(missing, assumptionsCount),
  }
}

/** Проверка нового значения панели «Уточнить допущение»: пусто или вне диапазона — текст исправления. */
export function validateAssumption(row: Pick<AssumptionRow, 'min' | 'max' | 'unit' | 'digits'>, value: number | null): string | null {
  const p = t.panel.errors
  if (value === null) return p.empty
  if (value < row.min || value > row.max) return p.range(formatNumber(row.min, row.digits), formatNumber(row.max, row.digits), row.unit)
  return null
}

/** Уточнения после правки: новое значение заменяет прежнее уточнение того же допущения, null — вернуть исходное. */
export function withOverride(overrides: readonly AssumptionOverride[], code: AssumptionCode, next: AssumptionOverride | null): readonly AssumptionOverride[] {
  const rest = overrides.filter((o) => o.code !== code)
  return next === null ? rest : [...rest, next]
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
