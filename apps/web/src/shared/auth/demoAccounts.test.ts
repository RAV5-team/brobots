import { describe, expect, it } from 'vitest'
import { readDemoAccounts } from './demoAccounts'

const ENV = {
  VITE_DEMO_USER_EMAIL: ' demo@example.test ',
  VITE_DEMO_USER_PASSWORD: 'user-secret',
  VITE_DEMO_ADMIN_EMAIL: 'admin@example.test',
  VITE_DEMO_ADMIN_PASSWORD: 'admin-secret',
}

describe('readDemoAccounts (D-16)', () => {
  it('returns nothing outside the demo build even when variables are set', () => {
    expect(readDemoAccounts(ENV, false)).toEqual([])
  })

  it('reads user and admin accounts in the demo build', () => {
    expect(readDemoAccounts(ENV, true)).toEqual([
      { role: 'user', email: 'demo@example.test', password: 'user-secret' },
      { role: 'admin', email: 'admin@example.test', password: 'admin-secret' },
    ])
  })

  it('skips an account without a password', () => {
    expect(readDemoAccounts({ ...ENV, VITE_DEMO_ADMIN_PASSWORD: '' }, true).map((a) => a.role)).toEqual(['user'])
  })
})
