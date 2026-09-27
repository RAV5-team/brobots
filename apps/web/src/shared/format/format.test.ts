import { describe, expect, it } from 'vitest'
import { formatCount, formatFileSize, formatNumber, formatPercent, formatRub, formatRubCompact, formatRubMillions, formatYears, pluralize, roundHalfUp } from './index'

// Intl вставляет неразрывные пробелы: U+00A0 перед ₽ и U+202F в разрядах.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('roundHalfUp (одно правило округления, D-19)', () => {
  it('rounds halves away from zero', () => {
    expect(roundHalfUp(129.5)).toBe(130)
    expect(roundHalfUp(-129.5)).toBe(-130)
    expect(roundHalfUp(136.36)).toBe(136)
  })

  it('rounds to the given number of digits without binary drift', () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
    expect(roundHalfUp(9.25, 1)).toBe(9.3)
  })
})

describe('formatNumber', () => {
  it('groups thousands and uses a decimal comma', () => {
    expect(plain(formatNumber(20000))).toBe('20 000')
    expect(plain(formatNumber(136.36, 1))).toBe('136,4')
  })

  it('does not print trailing zeros', () => {
    expect(formatNumber(2, 1)).toBe('2')
  })
})

describe('formatRub', () => {
  it('formats whole rubles', () => {
    expect(plain(formatRub(2700000))).toBe('2 700 000 ₽')
  })
})

describe('formatRubCompact', () => {
  it('uses one decimal below 10 million and whole numbers above', () => {
    expect(plain(formatRubCompact(9_240_000))).toBe('9,2 млн ₽')
    expect(plain(formatRubCompact(591_400_000))).toBe('591 млн ₽')
    expect(plain(formatRubCompact(26_000_000))).toBe('26 млн ₽')
  })

  it('switches to thousands and billions', () => {
    expect(plain(formatRubCompact(850_000))).toBe('850 тыс. ₽')
    expect(plain(formatRubCompact(1_250_000_000))).toBe('1,3 млрд ₽')
  })

  it('appends a period suffix', () => {
    expect(plain(formatRubCompact(9_240_000, { perYear: true }))).toBe('9,2 млн ₽/год')
  })
})

describe('formatRubMillions', () => {
  it('prints millions with exactly two decimals, as in the catalog (А1)', () => {
    expect(plain(formatRubMillions(3_750_000))).toBe('3,75 млн ₽')
    expect(plain(formatRubMillions(2_500_000))).toBe('2,50 млн ₽')
    expect(plain(formatRubMillions(950_000))).toBe('0,95 млн ₽')
    expect(plain(formatRubMillions(4_000_000))).toBe('4,00 млн ₽')
  })

  it('rounds halves up', () => {
    expect(plain(formatRubMillions(1_005_000))).toBe('1,01 млн ₽')
  })
})

describe('pluralize (Intl.PluralRules ru)', () => {
  const robots = ['робот', 'робота', 'роботов'] as const

  it.each([
    [1, 'робот'], [2, 'робота'], [3, 'робота'], [5, 'роботов'], [11, 'роботов'],
    [21, 'робот'], [22, 'робота'], [64, 'робота'], [111, 'роботов'],
  ])('%i → %s', (n, word) => {
    expect(pluralize(n, robots)).toBe(word)
  })

  it('uses the genitive singular for fractions', () => {
    expect(pluralize(0.7, ['год', 'года', 'лет'])).toBe('года')
  })
})

describe('formatCount', () => {
  it('joins number and word (PRD 15 · №50: «3 робота», not «3 роботов»)', () => {
    expect(plain(formatCount(3, ['робот', 'робота', 'роботов']))).toBe('3 робота')
    expect(plain(formatCount(1200, ['проба', 'пробы', 'проб']))).toBe('1 200 проб')
  })
})

describe('formatYears', () => {
  it('formats payback periods', () => {
    expect(plain(formatYears(0.7))).toBe('0,7 года')
    expect(plain(formatYears(2.2))).toBe('2,2 года')
    expect(plain(formatYears(1))).toBe('1 год')
    expect(plain(formatYears(5))).toBe('5 лет')
  })
})

describe('formatPercent', () => {
  it('formats shares as percents', () => {
    expect(plain(formatPercent(0.95))).toBe('95 %')
    expect(plain(formatPercent(0.125, 1))).toBe('12,5 %')
  })
})

describe('formatFileSize', () => {
  it('prints megabytes with one decimal, like «2,4 МБ» in А7', () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2,4 МБ')
    expect(formatFileSize(20 * 1024 * 1024)).toBe('20 МБ')
  })

  it('prints small files in kilobytes, never «0 МБ»', () => {
    expect(formatFileSize(350 * 1024)).toBe('350 КБ')
    expect(formatFileSize(10)).toBe('1 КБ')
  })
})
