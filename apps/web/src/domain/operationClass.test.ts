import { describe, expect, it } from 'vitest'
import { nextOperationClassCode } from './operationClass'

describe('nextOperationClassCode (PRD 6.7)', () => {
  it('returns OP-11 after the ten demo classes', () => {
    const codes = Array.from({ length: 10 }, (_, i) => `OP-${String(i + 1).padStart(2, '0')}` as const)
    expect(nextOperationClassCode(codes)).toBe('OP-11')
  })

  it('never reuses a code: takes the maximum, not the count', () => {
    expect(nextOperationClassCode(['OP-01', 'OP-07'])).toBe('OP-08')
  })

  it('starts from OP-01 on an empty directory and grows past two digits', () => {
    expect(nextOperationClassCode([])).toBe('OP-01')
    expect(nextOperationClassCode(['OP-99'])).toBe('OP-100')
  })
})
