import { describe, expect, it } from 'vitest'
import { activeNavKey, navItemsFor } from './navigation'

describe('navItemsFor (PRD 5.1, 5.3; D-01)', () => {
  it('gives the user six sections', () => {
    expect(navItemsFor('user').map((i) => i.key)).toEqual(['dashboard', 'projects', 'processes', 'locations', 'catalog', 'integrations'])
  })

  it('keeps «Интеграции» in the menu but closed until the section is ready', () => {
    expect(navItemsFor('user').filter((i) => i.disabled === true).map((i) => i.key)).toEqual(['integrations'])
  })

  it('adds administration for the admin', () => {
    expect(navItemsFor('admin').map((i) => i.key).at(-1)).toBe('admin')
  })

  it('gives the guest the demo menu', () => {
    expect(navItemsFor('guest').map((i) => i.key)).toEqual(['dashboard', 'projects', 'processes', 'locations', 'catalog'])
    expect(navItemsFor('guest')[1]?.label).toBe('Демо-проекты')
  })
})

describe('activeNavKey', () => {
  it.each([
    ['/', 'dashboard'], ['/projects/PJ-01/matching', 'projects'], ['/processes/new', 'processes'],
    ['/locations/LOC-01/params', 'locations'], ['/catalog', 'catalog'], ['/admin/norms', 'admin'],
    ['/integrations', 'integrations'], ['/profile', null],
  ] as const)('%s → %s', (path, key) => {
    expect(activeNavKey(path)).toBe(key)
  })
})
