import type { BadgeKind } from '@/components/ui/Badge'
import type {
  AssumptionOverride,
  PeakHours,
  Project,
  ProjectParamsSnapshot,
  Robot,
  SimulationConditions,
  TrafficLevel,
} from '@/domain'
import { formatNumber, parseDecimal, roundHalfUp } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { assumptionRows, defaultsOf, locationNumber, type AssumptionRow } from '../params/paramsModel'
import { DEFAULT_PEAK_HOURS, maxPeakHours, peaksWithin, workingHours } from './hourlyDemand'

const t = ru.project.simulation.conditions

/** Откуда значение условия (PRD 11.4): из задачи, по умолчанию, допущение; изменённое на этапе — «указано». */
export type ConditionOrigin = Extract<BadgeKind, 'task' | 'default' | 'assumption' | 'specified'>

export interface BaseValue<T> {
  readonly value: T
  readonly origin: ConditionOrigin
}

export type ConditionKey = keyof SimulationConditions
export type ConditionBases = { readonly [K in ConditionKey]: BaseValue<SimulationConditions[K]> }

/** Значения «по умолчанию» этапа 2 (PRD 11.4, таблица «Этап 2 · Условия симуляции»). */
export const CONDITION_DEFAULTS = {
  firstShiftStartHour: 7,
  maxWaitMin: 10,
  onTimeTarget: 0.95,
  growthReserve: 0.1,
  traffic: 'sometimes',
  fastMoversAtGates: false,
  repairHours: 2,
  fleetPolicy: 'add_and_reduce',
  designVolume: 'growth',
} as const satisfies Partial<SimulationConditions>

const HOURS_PER_DAY = 24
const PERCENT = 100

/** «Люди на маршруте» профиля локации → частота на этапе 2 (PRD 11.4: условие берётся из профиля, раздел 10.5). */
const TRAFFIC_OF_SITE: Readonly<Record<string, TrafficLevel>> = {
  редко: 'rare',
  периодически: 'sometimes',
  часто: 'often',
  постоянно: 'very_often',
}

function trafficOf(snapshot: ProjectParamsSnapshot): TrafficLevel | null {
  const raw = snapshot.siteValues.site_people_on_route?.value
  if (typeof raw !== 'string') return null
  return TRAFFIC_OF_SITE[raw.split('·')[0]?.trim().toLocaleLowerCase('ru') ?? ''] ?? null
}

/** Уточнение шага 1 как факт — «из задачи», иначе остаётся допущением. */
const assumptionOrigin = (row: AssumptionRow | undefined): ConditionOrigin =>
  row?.override?.kind === 'fact' ? 'task' : 'assumption'

export interface ConditionsContext {
  readonly snapshot: ProjectParamsSnapshot
  readonly project: Project
  /** Робот выбранного варианта — для коэффициента замещения по его способу обработки; null — не загрузился. */
  readonly robot: Robot | null
  /** Часов в сутки расчёта подбора — если режима нет в профиле локации. */
  readonly calcHours: number
  /** Допуск расхождения с расчётом по умолчанию — норматив А5 `simulation_tolerance_pct` (PRD 11.4, этап 2 «Проверка»). */
  readonly tolerance: number
}

/** Коэффициент замещения по способу обработки робота; нет совпадения — первый способ процесса. */
function replacementOf(ctx: ConditionsContext, handling: readonly { readonly method: string; readonly laborReplacementRatio?: number }[]) {
  const match = handling.find((h) => h.method === ctx.robot?.specs.handlingMethod) ?? handling[0]
  const method = ctx.snapshot.handlingMethods.find((m) => m.code === match?.method)?.name ?? null
  return { value: match?.laborReplacementRatio ?? 1, method: method?.toLocaleLowerCase('ru') ?? null }
}

/** Условия без правок пользователя и откуда каждое (D-102). null — процесса проекта нет в снимке. */
export function conditionBases(ctx: ConditionsContext, overrides: readonly AssumptionOverride[]): { readonly bases: ConditionBases; readonly handlingName: string | null } | null {
  const entry = ctx.snapshot.processes.find((p) => p.locationProcess.id === ctx.project.locationProcessId)
  if (!entry) return null
  const d = defaultsOf(entry)
  const assumptions = assumptionRows(entry, ctx.snapshot, overrides)
  const row = (code: string) => assumptions.find((a) => a.code === code)
  const shifts = locationNumber(ctx.snapshot, 'wh_shifts')
  const shiftHours = locationNumber(ctx.snapshot, 'wh_shift_hours')
  const peak = row('peak_factor')
  const route = row('route_length_m')
  const operators = row('operator_time_share_pct')
  const traffic = trafficOf(ctx.snapshot)
  const replacement = replacementOf(ctx, entry.locationProcess.handling ?? entry.process.handling)
  const working = workingHours(CONDITION_DEFAULTS.firstShiftStartHour, shifts ?? 1, shiftHours ?? ctx.calcHours)
  const peaks = peaksWithin(DEFAULT_PEAK_HOURS, working)
  const half = d.dailyVolume / 2
  const task = <T>(value: T): BaseValue<T> => ({ value, origin: 'task' })
  const byDefault = <T>(value: T): BaseValue<T> => ({ value, origin: 'default' })

  const bases: ConditionBases = {
    firstShiftStartHour: byDefault(CONDITION_DEFAULTS.firstShiftStartHour),
    shiftsPerDay: shifts !== null && shiftHours !== null ? task(shifts) : byDefault(1),
    shiftHours: shifts !== null && shiftHours !== null ? task(shiftHours) : task(ctx.calcHours),
    peakFactor: { value: peak?.value ?? d.peakFactor ?? 1, origin: assumptionOrigin(peak) },
    peakHours: byDefault<PeakHours>({ inbound: peaks, outbound: peaks }),
    // В задаче только общий объём: приёмка и отгрузка — пополам, как в примере PRD 11.4 (1 000 + 1 000).
    inboundPalletsPerDay: task(half),
    outboundPalletsPerDay: task(half),
    manualShare: task(roundHalfUp(1 - d.automationShare, 4)),
    maxWaitMin: byDefault(CONDITION_DEFAULTS.maxWaitMin),
    onTimeTarget: byDefault(CONDITION_DEFAULTS.onTimeTarget),
    growthReserve: byDefault(CONDITION_DEFAULTS.growthReserve),
    traffic: traffic ? task(traffic) : byDefault(CONDITION_DEFAULTS.traffic),
    fastMoversAtGates: byDefault(CONDITION_DEFAULTS.fastMoversAtGates),
    repairHours: byDefault(CONDITION_DEFAULTS.repairHours),
    routeLengthM: { value: route?.value ?? d.routeLengthM ?? 0, origin: assumptionOrigin(route) },
    operatorTimeShare: { value: (operators?.value ?? PERCENT) / PERCENT, origin: assumptionOrigin(operators) },
    laborReplacementRatio: { value: replacement.value, origin: 'assumption' },
    tolerance: byDefault(ctx.tolerance),
    fleetPolicy: byDefault(CONDITION_DEFAULTS.fleetPolicy),
    designVolume: byDefault(CONDITION_DEFAULTS.designVolume),
  }
  return { bases, handlingName: replacement.method }
}

/** Условия прогона: правки этапа поверх исходных. */
export function effectiveConditions(bases: ConditionBases, overrides: Partial<SimulationConditions>): SimulationConditions {
  // По ключам, а не через Object.fromEntries: новое условие без исходного значения не соберётся.
  const values = {
    firstShiftStartHour: bases.firstShiftStartHour.value,
    shiftsPerDay: bases.shiftsPerDay.value,
    shiftHours: bases.shiftHours.value,
    peakFactor: bases.peakFactor.value,
    peakHours: bases.peakHours.value,
    inboundPalletsPerDay: bases.inboundPalletsPerDay.value,
    outboundPalletsPerDay: bases.outboundPalletsPerDay.value,
    manualShare: bases.manualShare.value,
    maxWaitMin: bases.maxWaitMin.value,
    onTimeTarget: bases.onTimeTarget.value,
    growthReserve: bases.growthReserve.value,
    traffic: bases.traffic.value,
    fastMoversAtGates: bases.fastMoversAtGates.value,
    repairHours: bases.repairHours.value,
    routeLengthM: bases.routeLengthM.value,
    operatorTimeShare: bases.operatorTimeShare.value,
    laborReplacementRatio: bases.laborReplacementRatio.value,
    tolerance: bases.tolerance.value,
    fleetPolicy: bases.fleetPolicy.value,
    designVolume: bases.designVolume.value,
  } satisfies SimulationConditions
  return { ...values, ...overrides }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Метка поля: изменено на этапе — «указано», иначе происхождение исходного значения. */
export const originOf = (key: ConditionKey, bases: ConditionBases, overrides: Partial<SimulationConditions>): ConditionOrigin =>
  key in overrides && !same(overrides[key], bases[key].value) ? 'specified' : bases[key].origin

/** Правка одного условия: значение, равное исходному, правкой не считается — условие возвращается к источнику. */
export function withCondition<K extends ConditionKey>(
  overrides: Partial<SimulationConditions>, bases: ConditionBases, key: K, value: SimulationConditions[K],
): Partial<SimulationConditions> {
  const rest = Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== key)) as Partial<SimulationConditions>
  return same(value, bases[key].value) ? rest : { ...rest, [key]: value }
}

export type NumericConditionKey = {
  [K in ConditionKey]: SimulationConditions[K] extends number ? K : never
}[ConditionKey]

/** Числовое поле: границы и знаки — в единицах поля; `scale` — во сколько раз поле больше хранимого (доли — в %). */
export interface NumericFieldSpec {
  readonly key: NumericConditionKey
  readonly min: number
  readonly max: number
  readonly digits: number
  readonly scale: number
}

/** Диапазоны этапа 2 — решение команды (D-102): в PRD их нет. */
export const NUMERIC_FIELDS: Readonly<Record<NumericConditionKey, NumericFieldSpec>> = {
  firstShiftStartHour: { key: 'firstShiftStartHour', min: 0, max: 23, digits: 0, scale: 1 },
  shiftsPerDay: { key: 'shiftsPerDay', min: 1, max: 3, digits: 0, scale: 1 },
  shiftHours: { key: 'shiftHours', min: 1, max: 24, digits: 1, scale: 1 },
  peakFactor: { key: 'peakFactor', min: 1, max: 3, digits: 2, scale: 1 },
  inboundPalletsPerDay: { key: 'inboundPalletsPerDay', min: 0, max: 100_000, digits: 0, scale: 1 },
  outboundPalletsPerDay: { key: 'outboundPalletsPerDay', min: 0, max: 100_000, digits: 0, scale: 1 },
  manualShare: { key: 'manualShare', min: 0, max: 100, digits: 1, scale: PERCENT },
  maxWaitMin: { key: 'maxWaitMin', min: 1, max: 120, digits: 0, scale: 1 },
  onTimeTarget: { key: 'onTimeTarget', min: 50, max: 100, digits: 1, scale: PERCENT },
  growthReserve: { key: 'growthReserve', min: 0, max: 100, digits: 0, scale: PERCENT },
  repairHours: { key: 'repairHours', min: 0, max: 72, digits: 1, scale: 1 },
  routeLengthM: { key: 'routeLengthM', min: 5, max: 5_000, digits: 0, scale: 1 },
  operatorTimeShare: { key: 'operatorTimeShare', min: 1, max: 100, digits: 0, scale: PERCENT },
  laborReplacementRatio: { key: 'laborReplacementRatio', min: 0, max: 1, digits: 2, scale: 1 },
  tolerance: { key: 'tolerance', min: 0, max: 50, digits: 0, scale: PERCENT },
}

/** Хранимое значение в единицах поля: 0,95 → «95». */
export const toFieldText = (spec: NumericFieldSpec, value: number): string => formatNumber(value * spec.scale, spec.digits)

export type FieldParse =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string }

/** Число в диапазоне поля, в хранимых единицах; пустое поле — ошибка с диапазоном. */
export function parseConditionField(spec: NumericFieldSpec, text: string): FieldParse {
  const parsed = parseDecimal(text)
  const range = t.rangeError(formatNumber(spec.min, spec.digits), formatNumber(spec.max, spec.digits))
  if (parsed === null || parsed < spec.min || parsed > spec.max) return { ok: false, error: range }
  return { ok: true, value: roundHalfUp(parsed, spec.digits) / spec.scale }
}

/** Смены помещаются в сутки (смен × длительность ≤ 24 ч); иначе — текст ошибки у поля длительности. */
export const shiftsError = (c: Pick<SimulationConditions, 'shiftsPerDay' | 'shiftHours'>): string | null =>
  c.shiftsPerDay * c.shiftHours > HOURS_PER_DAY ? t.shiftsOverflow : null

/** Пиковых часов больше, чем выдерживают сутки при этом коэффициенте (D-102), — текст ошибки под сеткой. */
export function peaksError(c: SimulationConditions): string | null {
  const working = workingHours(c.firstShiftStartHour, c.shiftsPerDay, c.shiftHours)
  const limit = maxPeakHours(working.length, c.peakFactor)
  const most = Math.max(peaksWithin(c.peakHours.inbound, working).length, peaksWithin(c.peakHours.outbound, working).length)
  return most > limit ? t.peaks.tooMany(formatNumber(c.peakFactor, 2), limit) : null
}

const MAX_DENOMINATOR = 100

/** Доля простой дробью с наименьшим знаменателем до 100: 0,95 → 19 из 20 (подсказка «Доля паллет в срок», 16197:1430). */
export function simpleFraction(share: number): { readonly part: number; readonly whole: number } {
  for (let whole = 1; whole <= MAX_DENOMINATOR; whole += 1) {
    const part = share * whole
    if (Math.abs(part - Math.round(part)) < 1e-9) return { part: Math.round(part), whole }
  }
  return { part: Math.round(share * MAX_DENOMINATOR), whole: MAX_DENOMINATOR }
}
