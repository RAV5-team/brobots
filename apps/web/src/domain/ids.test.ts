import { describe, expect, it } from 'vitest'
import { parseLocationId, parseLocationProcessId, parseProcessCode, parseProjectId, parseRobotId } from './ids'

describe('parse*Id (идентификаторы из адреса)', () => {
  it('accepts ids of its own kind', () => {
    expect(parseProjectId('PJ-01')).toBe('PJ-01')
    expect(parseProjectId('PJ-DEMO')).toBe('PJ-DEMO')
    expect(parseLocationId('LOC-01')).toBe('LOC-01')
    expect(parseLocationProcessId('LP-12')).toBe('LP-12')
    expect(parseProcessCode('PR-0001')).toBe('PR-0001')
    expect(parseRobotId('RB-0187')).toBe('RB-0187')
  })

  it('rejects ids of another kind, empty and missing values', () => {
    expect(parseProjectId('LOC-01')).toBeNull()
    expect(parseLocationId('PJ-01')).toBeNull()
    expect(parseProjectId('PJ-')).toBeNull()
    expect(parseProjectId('')).toBeNull()
    expect(parseProjectId(null)).toBeNull()
    expect(parseProjectId(undefined)).toBeNull()
  })

  it('rejects values with a prefix only somewhere inside or trailing junk', () => {
    expect(parseRobotId('x-RB-0001')).toBeNull()
    expect(parseRobotId('RB-0001/../')).toBeNull()
    expect(parseLocationId('LOC-01 ')).toBeNull()
  })
})
