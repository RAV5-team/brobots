import { DATA_VERSION, PROFILES } from '@/mocks/fixtures/session'
import { DEMO_ACCOUNTS, type DemoAccount } from '@/shared/auth/demoAccounts'
import { InvalidCredentialsError } from '../errors'
import type { SessionService } from '../session'
import { respond, type MockOptions } from './respond'

/**
 * До Keycloak мок пускает только демо-учётки из окружения (D-16, D-24).
 * Вне демо-сборки учёток нет — войти можно лишь как гость через «Открыть демо».
 */
export function createMockSession(options: MockOptions, accounts: readonly DemoAccount[] = DEMO_ACCOUNTS): SessionService {
  return {
    signIn: ({ email, password }) => {
      const normalized = email.trim().toLowerCase()
      const account = accounts.find((a) => a.email.toLowerCase() === normalized && a.password === password)
      return account
        ? respond(PROFILES[account.role], options)
        : Promise.reject(new InvalidCredentialsError('Почта или пароль не подошли'))
    },
    getProfile: (role) => respond(PROFILES[role], options),
    getDataVersion: () => respond(DATA_VERSION, options),
  }
}
