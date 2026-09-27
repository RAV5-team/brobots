import { describe, expect, it } from 'vitest'
import { formatDate, formatDayOf, formatDayTime, parseDate } from './index'

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

  it('prints the Moscow day of a UTC moment as DD.MM.YYYY', () => {
    expect(formatDayOf('2026-09-14T09:00:00Z')).toBe('14.09.2026')
    expect(formatDayOf('2026-09-13T22:30:00Z')).toBe('14.09.2026')
  })

  it('prints the calendar day of an offset moment in Moscow time', () => {
    expect(formatDayOf('2026-08-12T12:00:00+03:00')).toBe('12.08.2026')
    expect(formatDayOf('2026-09-18T21:30:00Z')).toBe('19.09.2026')
  })
})

describe('parseDate — ввод даты «ДД.ММ.ГГГГ»', () => {
  it('turns a typed day into a calendar date', () => {
    expect(parseDate('19.09.2026')).toBe('2026-09-19')
    expect(parseDate(' 01.01.2027 ')).toBe('2027-01-01')
  })

  it('rejects impossible or incomplete dates', () => {
    expect(parseDate('31.02.2026')).toBeNull()
    expect(parseDate('19.9.2026')).toBeNull()
    expect(parseDate('2026-09-19')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})
