import { describe, expect, it } from 'vitest'
import { optionValue } from './optionValue'

describe('optionValue (значение Radix → вариант)', () => {
  const options = [{ value: 'rare' }, { value: 'often' }] as const

  it('returns the value of the matching option', () => {
    expect(optionValue(options, 'often')).toBe('often')
  })

  it('returns undefined for a string that is not an option', () => {
    expect(optionValue(options, 'never')).toBeUndefined()
    expect(optionValue(options, '')).toBeUndefined()
  })
})
