import { describe, expect, it } from 'vitest'
import { formatDate, formatDayTime } from './index'

describe('dates in the organisation time zone', () => {
  it('prints the day, month and time of a UTC moment in Moscow time', () => {
    expect(formatDayTime('2026-09-15T11:32:00Z')).toBe('15.09 14:32')
  })

  it('crosses midnight when Moscow is already on the next day', () => {
    expect(formatDayTime('2026-09-14T22:05:00Z')).toBe('15.09 01:05')
  })

  it('prints a calendar date as DD.MM.YYYY without shifting the day', () => {
    expect(formatDate('2026-09-15')).toBe('15.09.2026')
  })
})
