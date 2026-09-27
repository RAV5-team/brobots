import { describe, expect, it } from 'vitest'
import { createdLocationState, readCreatedLocationId } from './createdLocation'

describe('readCreatedLocationId', () => {
  it('reads the id that form 14 passes back to the list', () => {
    expect(readCreatedLocationId(createdLocationState('LOC-05'))).toBe('LOC-05')
  })

  it.each([
    ['no state', null],
    ['a foreign state', { from: '/processes' }],
    ['a non-string id', { createdLocationId: 5 }],
    ['an id of another entity', { createdLocationId: 'PR-0001' }],
  ])('ignores %s', (_case, state) => {
    expect(readCreatedLocationId(state)).toBeNull()
  })
})
