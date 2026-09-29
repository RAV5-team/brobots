import { describe, expect, it } from 'vitest'
import { kcEnvDefaults } from '../kc.gen'
import { DEMO_PROPERTIES } from './mocks'
import { appUrl, demoAccountsOf, publicSiteUrl } from './themeLinks'

const properties = { ...kcEnvDefaults }

describe('themeLinks', () => {
  it('takes the app address from RAV5_APP_URL, the root without Keycloak', () => {
    expect(appUrl({ properties: { ...properties, RAV5_APP_URL: 'http://localhost:5173/' } })).toBe('http://localhost:5173/')
    expect(appUrl({ properties })).toBe('/')
  })

  it('falls back to the app for the public site link (D-28)', () => {
    expect(publicSiteUrl({ properties: { ...properties, RAV5_APP_URL: 'http://localhost/' } })).toBe('http://localhost/')
    expect(publicSiteUrl({ properties: { ...properties, RAV5_PUBLIC_SITE_URL: 'https://rav5.example' } })).toBe('https://rav5.example')
  })

  it('shows a demo plate only when Keycloak passed both email and password (D-16)', () => {
    expect(demoAccountsOf({ properties })).toEqual([])
    expect(demoAccountsOf({ properties: { ...properties, RAV5_DEMO_USER_EMAIL: 'demo@rav5.ru' } })).toEqual([])
    expect(demoAccountsOf({ properties: { ...properties, ...DEMO_PROPERTIES } }).map((a) => a.role)).toEqual(['user', 'admin'])
  })
})
