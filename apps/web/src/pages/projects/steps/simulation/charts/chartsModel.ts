import type { ChartSeries } from '@/components/charts/chartTones'
import type { Fleet, HourlyStat, SimulationRun } from '@/domain'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { sameFleet } from '../verdictModel'

const t = ru.project.simulation
const SECONDS_PER_HOUR = 3600
const HOURS_PER_DAY = 24

/** Роботы заняты больше этой доли часа — нарушение (подпись 16198:676). */
export const BUSY_LIMIT = 0.95

/** Требования к сервису из условий этапа 2 (по умолчанию — 95 % в срок, ожидание до 10 мин). */
export interface ServiceTargets {
  readonly onTimeTarget: number
  readonly maxWaitMin: number
}

/** Сегменты «На что уходит время робота» (16198:677) — группы состояний движка, как в вебе сервиса. */
export type TimeSegment = 'carrying' | 'toPickup' | 'blocked' | 'charging' | 'down' | 'idle'

export const TIME_SEGMENTS: readonly (ChartSeries & { readonly key: TimeSegment })[] = [
  { key: 'carrying', label: t.time.carrying, tone: 'strong' },
  { key: 'toPickup', label: t.time.toPickup, tone: 'secondary' },
  { key: 'blocked', label: t.time.blocked, tone: 'danger' },
  { key: 'charging', label: t.time.charging, tone: 'accent' },
  { key: 'down', label: t.time.down, tone: 'danger-soft' },
  { key: 'idle', label: t.time.idle, tone: 'subtle' },
]

/** Состояние робота в `fleet_shares` (simcore.engine.STATES) → сегмент полосы. */
const SEGMENT_OF: Readonly<Record<string, TimeSegment>> = {
  to_drop: 'carrying', loading: 'carrying', unloading: 'carrying',
  to_pickup: 'toPickup',
  blocked: 'blocked', queue: 'blocked',
  to_charger: 'charging', wait_charger: 'charging', charging: 'charging',
  down: 'down', towed: 'down',
  idle: 'idle',
}

/** Доли состояний → доли сегментов; неизвестное состояние — «свободен». Пусто — сервис не передал доли. */
export function timeSegments(shares: Readonly<Record<string, number>>): Readonly<Record<TimeSegment, number>> | null {
  const entries = Object.entries(shares)
  if (entries.length === 0) return null
  const empty: Record<TimeSegment, number> = { carrying: 0, toPickup: 0, blocked: 0, charging: 0, down: 0, idle: 0 }
  return entries.reduce<Record<TimeSegment, number>>((acc, [state, share]) => {
    const key = SEGMENT_OF[state] ?? 'idle'
    return { ...acc, [key]: acc[key] + share }
  }, empty)
}

/** «В рейсе» — везёт паллету и едет за ней (как «в рейсе» у сервиса). */
export const tripShare = (segments: Readonly<Record<TimeSegment, number>>): number => {
  const total = Object.values(segments).reduce((a, b) => a + b, 0)
  return total === 0 ? 0 : (segments.carrying + segments.toPickup) / total
}

/** Составы вкладки: проверенный `from` и итоговый `to` с подписями; у одного состава — одна запись. */
export interface ChartFleet {
  readonly key: 'before' | 'after'
  readonly title: string
  readonly fleet: Fleet
  readonly hours: readonly HourlyStat[]
  readonly shares: Readonly<Record<string, number>>
}

export function chartFleets(run: SimulationRun, fromMatching: Fleet): readonly ChartFleet[] {
  const fromTitle = sameFleet(run.from, fromMatching) ? t.charts.from.matching : t.charts.from.checked
  const after: ChartFleet = {
    key: 'after',
    title: run.verdict === 'can_reduce' || run.verdict === 'need_more' ? t.charts.to[run.verdict] : t.charts.to.other,
    fleet: run.to,
    hours: run.hourlyAfter,
    shares: run.fleetShares,
  }
  if (sameFleet(run.from, run.to)) return [{ ...after, key: 'before', title: fromTitle }]
  return [{ key: 'before', title: fromTitle, fleet: run.from, hours: run.hourlyBefore, shares: run.before.fleetShares }, after]
}

/** «Из подбора: 18 роботов, 6 станций». */
export const fleetCaption = (f: ChartFleet): string =>
  t.charts.fleet(f.title, formatCount(f.fleet.robots, ru.plural.robots), formatCount(f.fleet.stations, ru.plural.stations))

export const hourLabel = (hour: number): string => String(hour).padStart(2, '0')

/** Нарушения часа по строкам таблицы: выполнено меньше потребности, занятость выше 95 %, паллеты позже срока. */
export interface HourViolations {
  readonly done: boolean
  readonly utilization: boolean
  readonly onTime: boolean
  readonly waitMean: boolean
}

export function hourViolations(h: HourlyStat, targets: ServiceTargets): HourViolations {
  return {
    done: h.done < h.demand,
    utilization: h.utilization > BUSY_LIMIT,
    onTime: h.onTime !== null && h.onTime < targets.onTimeTarget,
    waitMean: h.waitMeanMin !== null && h.waitMeanMin > targets.maxWaitMin,
  }
}

export const hasViolation = (v: HourViolations): boolean => v.done || v.utilization || v.onTime || v.waitMean

/** Пиковый час — потребность не ниже пика, на который рассчитан подбор. */
export const isPeakHour = (h: HourlyStat, run: SimulationRun): boolean => h.demand > 0 && h.demand >= run.peak.requiredPerHour

/** Строка таблицы «Что происходило по часам»: значение и нарушение по каждому часу. */
export interface HourlyRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly { readonly value: string; readonly violation: boolean }[]
}

const whole = (v: number | null): string => (v === null ? '—' : formatNumber(v))
const percent = (v: number | null): string => (v === null ? '—' : formatNumber(v * 100))

export function hourlyRows(hours: readonly HourlyStat[], targets: ServiceTargets): readonly HourlyRow[] {
  const flags = hours.map((h) => hourViolations(h, targets))
  const row = (key: string, label: string, value: (h: HourlyStat) => string, flag?: keyof HourViolations): HourlyRow => ({
    key,
    label,
    cells: hours.map((h, i) => ({ value: value(h), violation: flag ? (flags[i]?.[flag] ?? false) : false })),
  })
  const l = t.hourly
  return [
    row('demand', l.demand, (h) => whole(h.demand)),
    row('done', l.done, (h) => whole(h.done), 'done'),
    row('utilization', l.utilization, (h) => percent(h.utilization), 'utilization'),
    row('idle', l.idle, (h) => whole(h.idle)),
    row('charging', l.charging, (h) => whole(h.charging)),
    row('waitingCharger', l.waitingCharger, (h) => whole(h.waitingCharger)),
    row('waitMean', l.waitMean, (h) => whole(h.waitMeanMin), 'waitMean'),
    row('onTime', l.onTime, (h) => percent(h.onTime), 'onTime'),
  ]
}

/** Часы объекта для времени записи: «08:12». */
export function clockOf(clockOffsetH: number, seconds: number): { readonly hour: number; readonly label: string } {
  const total = (((clockOffsetH * SECONDS_PER_HOUR + seconds) % (HOURS_PER_DAY * SECONDS_PER_HOUR)) + HOURS_PER_DAY * SECONDS_PER_HOUR) % (HOURS_PER_DAY * SECONDS_PER_HOUR)
  const hour = Math.floor(total / SECONDS_PER_HOUR)
  const minute = Math.floor((total % SECONDS_PER_HOUR) / 60)
  return { hour, label: `${hourLabel(hour)}:${String(minute).padStart(2, '0')}` }
}

/** Стартовая точка плеера: начало первого пикового часа после начала записи (D-105); пиков нет — начало записи. */
export function initialTime(clockOffsetH: number, hours: readonly HourlyStat[], run: SimulationRun, duration: number): number {
  const offsets = hours.filter((h) => isPeakHour(h, run)).map((h) => ((h.hour - clockOffsetH + HOURS_PER_DAY) % HOURS_PER_DAY) * SECONDS_PER_HOUR)
  const first = Math.min(...offsets.filter((s) => s <= duration))
  return Number.isFinite(first) ? first : 0
}

/** Составы вкладки на доске (3.5): второй — всегда «С изменениями», какой бы ни был вердикт. Отчёт 09 — на `chartFleets`. */
export function boardFleets(run: SimulationRun, fromMatching: Fleet): readonly ChartFleet[] {
  return chartFleets(run, fromMatching).map((f) => (f.key === 'after' ? { ...f, title: t.charts.changed } : f))
}

/** Часы суток по порядку от начала первой смены: 07 … 06 (3.5, как сетка этапа 2). */
export function fromShiftStart(hours: readonly HourlyStat[], startHour: number): readonly HourlyStat[] {
  const at = hours.findIndex((h) => h.hour === startHour)
  return at <= 0 ? hours : [...hours.slice(at), ...hours.slice(0, at)]
}

export interface BoardHourlyRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly { readonly value: string; readonly violation: boolean }[]
}

export interface BoardHourlyMetric {
  readonly key: string
  readonly label: string
  readonly requirement?: string
  readonly rows: readonly BoardHourlyRow[]
}

const oneDecimal = (v: number | null): string => (v === null ? '—' : formatNumber(v, 1, { fixed: true }))

/**
 * Таблица «Что происходило по часам» на доске (3.5, 17040:225): общая строка «Потребность», группы «Нагрузка на парк» и
 * «Результат», у показателя — строка на каждый состав. Нарушение — у выполненных рейсов, ожидания и доли в срок
 * (требования этапа 2); загрузку роботов доска не отмечает.
 */
export function boardHourly(fleets: readonly ChartFleet[], targets: ServiceTargets, startHour: number) {
  const l = t.hourly
  const r = t.charts.requirement
  const byFleet = fleets.map((f) => ({ fleet: f, hours: fromShiftStart(f.hours, startHour) }))
  const metric = (key: string, label: string, value: (h: HourlyStat) => string, flag?: keyof HourViolations, requirement?: string): BoardHourlyMetric => ({
    key,
    label,
    ...(requirement === undefined ? {} : { requirement }),
    rows: byFleet.map(({ fleet, hours }) => ({
      key: `${key}-${fleet.key}`,
      label: fleet.title,
      cells: hours.map((h) => ({ value: value(h), violation: flag ? hourViolations(h, targets)[flag] : false })),
    })),
  })
  const demandHours = byFleet[0]?.hours ?? []
  return {
    columns: demandHours.map((h) => hourLabel(h.hour)),
    demand: { key: 'demand', label: l.demand, cells: demandHours.map((h) => ({ value: whole(h.demand), violation: false })) },
    groups: [
      {
        key: 'load',
        title: t.charts.groups.load,
        metrics: [
          metric('utilization', l.utilization, (h) => percent(h.utilization)),
          metric('idle', l.idle, (h) => oneDecimal(h.idle)),
          metric('waitingCharger', l.waitingCharger, (h) => oneDecimal(h.waitingCharger)),
          metric('charging', l.charging, (h) => oneDecimal(h.charging)),
        ],
      },
      {
        key: 'result',
        title: t.charts.groups.result,
        metrics: [
          metric('done', l.done, (h) => whole(h.done), 'done', r.done),
          metric('waitMean', l.waitMean, (h) => oneDecimal(h.waitMeanMin), 'waitMean', r.waitMean(formatNumber(targets.maxWaitMin))),
          metric('onTime', l.onTime, (h) => percent(h.onTime), 'onTime', r.onTime(formatPercent(targets.onTimeTarget))),
        ],
      },
    ],
  }
}
