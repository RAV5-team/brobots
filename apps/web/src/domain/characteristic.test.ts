import { describe, expect, it } from 'vitest'
import { completeness, countByStatus, type Characteristic } from './characteristic'

const c = (status: Characteristic['status']): Characteristic => ({ value: status === 'missing' ? null : 'x', status, source: 'тест' })

describe('characteristic stats (D-77)', () => {
  it('counts statuses and completeness from the rows, not from stored totals', () => {
    const rows = [c('confirmed'), c('confirmed'), c('estimate'), c('missing')]
    expect(countByStatus(rows)).toEqual({ confirmed: 2, estimate: 1, missing: 1 })
    expect(completeness(rows)).toEqual({ filled: 3, total: 4 })
    expect(completeness([])).toEqual({ filled: 0, total: 0 })
  })
})
