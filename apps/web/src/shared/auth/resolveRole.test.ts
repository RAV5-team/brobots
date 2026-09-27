import { describe, expect, it } from 'vitest'
import { canAccess, resolveRole } from './resolveRole'

describe('resolveRole (D-14, D-16, D-24)', () => {
  const dev = { allowUrlRole: true, fallback: 'user' } as const

  it('takes ?as= when switching by URL is allowed', () => {
    expect(resolveRole({ ...dev, search: '?as=admin', stored: null })).toEqual({ role: 'admin', persist: 'admin' })
  })

  it('ignores ?as= outside dev and demo builds', () => {
    expect(resolveRole({ allowUrlRole: false, fallback: 'guest', search: '?as=admin', stored: 'admin' })).toEqual({
      role: 'guest',
      persist: null,
    })
  })

  it('ignores unknown roles', () => {
    expect(resolveRole({ ...dev, search: '?as=root', stored: null })).toEqual({ role: 'user', persist: null })
  })

  it('keeps the stored role when the URL has none', () => {
    expect(resolveRole({ ...dev, search: '?tab=1', stored: 'guest' })).toEqual({ role: 'guest', persist: null })
  })

  it('drops a corrupted stored value', () => {
    expect(resolveRole({ ...dev, search: '', stored: 'hacker' })).toEqual({ role: 'user', persist: null })
  })
})

describe('canAccess (PRD 5.3)', () => {
  it.each([
    ['guest', '/', true], ['guest', '/catalog', true], ['guest', '/processes/PR-0001', true],
    ['guest', '/projects/PJ-01/matching', true], ['guest', '/integrations', false], ['guest', '/admin/norms', false],
    ['guest', '/profile', false], ['user', '/integrations', true], ['user', '/admin/catalog', false],
    ['admin', '/admin/catalog/new', true], ['guest', '/login', true],
  ] as const)('%s → %s: %s', (role, path, allowed) => {
    expect(canAccess(role, path)).toBe(allowed)
  })
})
