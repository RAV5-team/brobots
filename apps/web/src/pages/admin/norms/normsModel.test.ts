import { describe, expect, it } from 'vitest'
import type { Norm } from '@/domain'
import { NORMS } from '@/mocks/fixtures/norms'
import { buildNormRows, collectNormChanges, formatNormValue, parseNormValue } from './normsModel'

const norm = (overrides: Partial<Norm> = {}): Norm => ({
  code: 'robot_utilization_pct',
  name: 'Коэффициент загрузки робота',
  group: 'fleet',
  kind: 'norm',
  value: 80,
  unit: '%',
  source: 'Датасет',
  ...overrides,
})

describe('formatNormValue', () => {
  it('writes numbers the Russian way, as on screen А5', () => {
    expect(formatNormValue(norm({ value: 1.302 }))).toBe('1,302')
    expect(formatNormValue(norm({ value: 7.5 }))).toBe('7,5')
    expect(formatNormValue(norm({ value: 250_000 }))).toBe('250 000')
    expect(formatNormValue(norm({ value: 0 }))).toBe('0')
  })

  it('prefixes symmetric tolerances with ±', () => {
    expect(formatNormValue(norm({ value: 10, symmetric: true }))).toBe('±10')
  })
})

describe('parseNormValue', () => {
  it('accepts comma or dot decimals and thousands separators', () => {
    expect(parseNormValue('7,5')).toEqual({ ok: true, value: 7.5 })
    expect(parseNormValue(' 1.302 ')).toEqual({ ok: true, value: 1.302 })
    expect(parseNormValue('250 000')).toEqual({ ok: true, value: 250_000 })
    expect(parseNormValue('250 000')).toEqual({ ok: true, value: 250_000 })
  })

  it('accepts a leading ± for tolerances', () => {
    expect(parseNormValue('±15')).toEqual({ ok: true, value: 15 })
  })

  it('rejects empty, non-numeric and negative input', () => {
    expect(parseNormValue('   ')).toEqual({ ok: false, error: 'empty' })
    expect(parseNormValue('пять')).toEqual({ ok: false, error: 'notNumber' })
    expect(parseNormValue('1,2,3')).toEqual({ ok: false, error: 'notNumber' })
    expect(parseNormValue('-3')).toEqual({ ok: false, error: 'negative' })
  })
})

describe('buildNormRows', () => {
  it('shows saved values when nothing is edited', () => {
    const rows = buildNormRows(NORMS, {})
    expect(rows).toHaveLength(34)
    expect(rows[0]).toMatchObject({ text: '1,302', isDirty: false, error: null })
  })

  it('marks edited rows as dirty and ignores edits equal to the saved value', () => {
    const [changed, same] = buildNormRows([norm(), norm({ code: 'b', value: 7.5 })], { robot_utilization_pct: '85', b: '7.50' })
    expect(changed).toMatchObject({ text: '85', isDirty: true, error: null })
    expect(same).toMatchObject({ text: '7.50', isDirty: false, error: null })
  })

  it('keeps invalid input with its error', () => {
    const [row] = buildNormRows([norm()], { robot_utilization_pct: 'abc' })
    expect(row).toMatchObject({ text: 'abc', isDirty: true, error: 'notNumber' })
  })
})

describe('collectNormChanges', () => {
  it('returns only changed values', () => {
    const result = collectNormChanges([norm(), norm({ code: 'b', value: 3 })], { robot_utilization_pct: '85', b: '3' })
    expect(result).toEqual({ changes: [{ code: 'robot_utilization_pct', value: 85 }], invalidCount: 0 })
  })

  it('counts invalid edits so saving can be blocked', () => {
    const result = collectNormChanges([norm()], { robot_utilization_pct: '' })
    expect(result).toEqual({ changes: [], invalidCount: 1 })
  })
})
