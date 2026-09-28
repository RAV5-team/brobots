import { describe, expect, it } from 'vitest'
import { initialsOf, profileOf } from '@/services/api/session'
import { parseRealmUrl, roleFromClaims, userFromClaims } from './oidc'

describe('parseRealmUrl', () => {
  it('splits the realm address for keycloak-js', () => {
    expect(parseRealmUrl('http://localhost/auth/realms/rav5')).toEqual({ url: 'http://localhost/auth', realm: 'rav5' })
  })

  it('rejects an address without a realm', () => {
    expect(() => parseRealmUrl('http://localhost/auth')).toThrow(/VITE_OIDC_URL/)
  })
})

describe('token claims', () => {
  it('maps realm roles to the platform role', () => {
    expect(roleFromClaims({ realm_access: { roles: ['default-roles-rav5', 'user', 'admin'] } })).toBe('admin')
    expect(roleFromClaims({ realm_access: { roles: ['default-roles-rav5', 'user'] } })).toBe('user')
    expect(roleFromClaims({})).toBe('user')
  })

  it('builds the cabinet profile from the token', () => {
    const user = userFromClaims({ name: 'Анна Петрова', email: 'user@example.com', realm_access: { roles: ['user'] } })
    expect(profileOf(user)).toEqual({ role: 'user', name: 'Анна Петрова', initials: 'АП', email: 'user@example.com', organization: null })
    expect(userFromClaims({ preferred_username: 'admin@example.com' }).name).toBe('admin@example.com')
    expect(initialsOf('')).toBe('?')
  })
})
