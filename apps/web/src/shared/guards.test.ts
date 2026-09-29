import { describe, expect, it } from 'vitest'
import { isArrayOf, isBoolean, isFiniteNumber, isObject, isOneOf, isString } from './guards'

describe('guards (данные извне)', () => {
  it('checks primitives', () => {
    expect(isObject({})).toBe(true)
    expect(isObject(null)).toBe(false)
    expect(isString('')).toBe(true)
    expect(isBoolean(false)).toBe(true)
    expect(isBoolean('false')).toBe(false)
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(Number.NaN)).toBe(false)
  })

  it('checks every array item', () => {
    expect(isArrayOf(['a', 'b'], isString)).toBe(true)
    expect(isArrayOf([], isString)).toBe(true)
    expect(isArrayOf(['a', 1], isString)).toBe(false)
    expect(isArrayOf('a', isString)).toBe(false)
  })

  it('accepts only listed options', () => {
    const options = ['forks', 'tow'] as const
    expect(isOneOf(options, 'tow')).toBe(true)
    expect(isOneOf(options, 'wings')).toBe(false)
    expect(isOneOf(options, 1)).toBe(false)
  })
})
