import { describe, expect, it } from 'vitest'
import { DEFAULT_PEAK_HOURS, calcMargin, demandProfile, flowByHour, heaviestHour, hoursFrom, maxPeakHours, workingHours } from './hourlyDemand'

const DEMO = {
  startHour: 7,
  shiftsPerDay: 2,
  shiftHours: 11,
  peakFactor: 1.5,
  peakHours: { inbound: DEFAULT_PEAK_HOURS, outbound: DEFAULT_PEAK_HOURS },
  inboundPerDay: 1000,
  outboundPerDay: 1000,
  manualShare: 0.05,
}
const CALC_PEAK = 2000 / 22 * 1.5 * 0.95

describe('часы смен (PRD 11.4, D-102)', () => {
  it('сутки от начала первой смены: 07 … 06', () => {
    expect(hoursFrom(7).slice(0, 3)).toEqual([7, 8, 9])
    expect(hoursFrom(7).at(-1)).toBe(6)
  })

  it('2 смены × 11 ч — 22 рабочих часа, 05 и 06 вне смен', () => {
    const working = workingHours(7, 2, 11)
    expect(working).toHaveLength(22)
    expect(working).not.toContain(5)
    expect(working).not.toContain(6)
  })

  it('пиковых часов не больше, чем выдерживают сутки', () => {
    expect(maxPeakHours(22, 1.5)).toBe(14)
    expect(maxPeakHours(22, 1)).toBe(22)
  })
})

describe('потребность по часам', () => {
  it('сумма потока за сутки сохраняется, пик — средний × коэффициент', () => {
    const working = workingHours(7, 2, 11)
    const byHour = flowByHour({ perDay: 950, peaks: [8, 9] }, working, 1.5)
    const total = [...byHour.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(950)
    expect(byHour.get(8)).toBeCloseTo(950 / 22 * 1.5)
  })

  it('пики совпадают, как в расчёте: самый тяжёлый час равен пику подбора, запас 0', () => {
    const profile = demandProfile(DEMO)
    expect(heaviestHour(profile)).toBeCloseTo(CALC_PEAK)
    expect(calcMargin(CALC_PEAK, heaviestHour(profile))).toBeCloseTo(0)
    expect(profile.filter((h) => h.isPeak)).toHaveLength(7)
    expect(profile.filter((h) => !h.isWorking).every((h) => h.trips === 0)).toBe(true)
  })

  it('пики приёмки и отгрузки разошлись — самый тяжёлый час легче', () => {
    const profile = demandProfile({ ...DEMO, peakHours: { inbound: [7, 8, 9, 10], outbound: [17, 18, 19] } })
    expect(heaviestHour(profile)).toBeLessThan(CALC_PEAK)
    expect(calcMargin(CALC_PEAK, heaviestHour(profile))).toBeGreaterThan(0)
  })
})
