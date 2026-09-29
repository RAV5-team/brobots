import type { PeakHours } from '@/domain'

const HOURS_PER_DAY = 24

/** Пики по умолчанию — как в расчёте: у приёмки и отгрузки совпадают (16197:1543: 07–10 и 17–19). */
export const DEFAULT_PEAK_HOURS: readonly number[] = [7, 8, 9, 10, 17, 18, 19]

/** Часы суток по порядку от начала первой смены: 07, 08 … 06 (PRD 11.4, «сетка часов 07–06»). */
export function hoursFrom(startHour: number): readonly number[] {
  return Array.from({ length: HOURS_PER_DAY }, (_, i) => (startHour + i) % HOURS_PER_DAY)
}

/** Рабочие часы: смены подряд от начала первой; дробный остаток смены считается целым часом. */
export function workingHours(startHour: number, shiftsPerDay: number, shiftHours: number): readonly number[] {
  const total = Math.min(HOURS_PER_DAY, Math.ceil(shiftsPerDay * shiftHours))
  return hoursFrom(startHour).slice(0, total)
}

/** Пиковые часы потока внутри смен: час вне смен пиком быть не может. */
export const peaksWithin = (peaks: readonly number[], working: readonly number[]): readonly number[] =>
  peaks.filter((h) => working.includes(h))

/**
 * Больше всего пиковых часов, при которых сутки сходятся: в пик — средний час × коэффициент, остальным рабочим часам
 * достаётся остаток, и он не может быть отрицательным.
 */
export const maxPeakHours = (workingCount: number, peakFactor: number): number =>
  peakFactor <= 1 ? workingCount : Math.floor(workingCount / peakFactor)

export interface FlowInput {
  /** Рейсов роботов в сутки: паллет за вычетом тех, что остаются вручную. */
  readonly perDay: number
  readonly peaks: readonly number[]
}

/**
 * Рейсов в час одного потока по часам суток (D-102): в пиковый час — средний × коэффициент пика, в прочие рабочие —
 * поровну остаток, вне смен — 0. Сумма за сутки всегда равна `perDay`.
 */
export function flowByHour(flow: FlowInput, working: readonly number[], peakFactor: number): ReadonlyMap<number, number> {
  const count = working.length
  if (count === 0) return new Map()
  const peaks = peaksWithin(flow.peaks, working)
  const average = flow.perDay / count
  const peakValue = peaks.length === count ? average : average * peakFactor
  const rest = count - peaks.length
  const offPeak = rest === 0 ? 0 : Math.max(0, (flow.perDay - peakValue * peaks.length) / rest)
  return new Map(working.map((h) => [h, peaks.includes(h) ? peakValue : offPeak]))
}

export interface DemandHour {
  readonly hour: number
  /** Рейсов в час: приёмка + отгрузка. */
  readonly trips: number
  /** Слагаемые `trips` — стопка графика 3.2 (приёмка снизу). */
  readonly inbound: number
  readonly outbound: number
  readonly isPeak: boolean
  readonly isWorking: boolean
}

export interface DemandProfileInput {
  readonly startHour: number
  readonly shiftsPerDay: number
  readonly shiftHours: number
  readonly peakFactor: number
  readonly peakHours: PeakHours
  readonly inboundPerDay: number
  readonly outboundPerDay: number
  /** Доля 0–1, которая остаётся вручную (негабарит). */
  readonly manualShare: number
}

/** Потребность по часам от начала первой смены — для графика «Потребность по часам» (3.2, 16325:158). */
export function demandProfile(input: DemandProfileInput): readonly DemandHour[] {
  const working = workingHours(input.startHour, input.shiftsPerDay, input.shiftHours)
  const robotShare = 1 - input.manualShare
  const inbound = flowByHour({ perDay: input.inboundPerDay * robotShare, peaks: input.peakHours.inbound }, working, input.peakFactor)
  const outbound = flowByHour({ perDay: input.outboundPerDay * robotShare, peaks: input.peakHours.outbound }, working, input.peakFactor)
  return hoursFrom(input.startHour).map((hour) => ({
    hour,
    trips: (inbound.get(hour) ?? 0) + (outbound.get(hour) ?? 0),
    inbound: inbound.get(hour) ?? 0,
    outbound: outbound.get(hour) ?? 0,
    isPeak: working.includes(hour) && (input.peakHours.inbound.includes(hour) || input.peakHours.outbound.includes(hour)),
    isWorking: working.includes(hour),
  }))
}

/** Самый тяжёлый час сценария, рейсов. */
export const heaviestHour = (profile: readonly DemandHour[]): number =>
  profile.reduce((max, h) => Math.max(max, h.trips), 0)

/** Запас подбора относительно самого тяжёлого часа, доля: 0 — впритык, отрицательный — час тяжелее расчёта. */
export const calcMargin = (calcPeak: number, heaviest: number): number =>
  calcPeak <= 0 ? 0 : (calcPeak - heaviest) / calcPeak
