import { describe, expect, it, vi } from 'vitest'
import { createMockSession } from '../mock/session'
import { oidcSession } from './session'

const USER = { name: 'Анна Петрова', email: 'user@example.com', role: 'admin' as const }

describe('oidcSession', () => {
  it('sends the email as a login hint and never resolves while the browser leaves', async () => {
    const login = vi.fn(() => Promise.resolve())
    const session = oidcSession(createMockSession({ latencyMs: 0 }), { currentUser: () => null, login })
    const outcome = await Promise.race([session.signIn({ email: ' user@example.com ', password: '' }), Promise.resolve('pending')])
    expect(outcome).toBe('pending')
    expect(login).toHaveBeenCalledWith('user@example.com')
  })

  it('takes the profile from the token, the guest from the fallback', async () => {
    const session = oidcSession(createMockSession({ latencyMs: 0 }), { currentUser: () => USER, login: () => Promise.resolve() })
    await expect(session.getProfile('admin')).resolves.toMatchObject({ name: 'Анна Петрова', initials: 'АП', role: 'admin' })
    await expect(session.getProfile('guest')).resolves.toMatchObject({ role: 'guest' })
  })
})
