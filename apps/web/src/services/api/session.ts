import type { Profile } from '@/domain'
import { currentUser, login, type AuthUser } from '@/shared/auth/oidc'
import type { Services } from '../index'
import type { SessionService } from '../session'

/** «Анна Петрова» → «АП»; почта → первая буква. */
export function initialsOf(name: string): string {
  const letters = name.split(/[\s@._-]+/u).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase('ru'))
  return letters.join('') || '?'
}

export function profileOf(user: AuthUser): Profile {
  return { role: user.role, name: user.name, initials: initialsOf(user.name), email: user.email, organization: null }
}

/**
 * Вход через Keycloak: signIn уводит на страницу входа (почта — подсказкой), профиль — из токена.
 * Гость и версии данных — как у запасной реализации.
 */
export function oidcSession(fallback: SessionService, auth: { readonly currentUser: () => AuthUser | null; readonly login: (hint?: string) => Promise<void> } = { currentUser, login }): SessionService {
  return {
    ...fallback,
    signIn: async ({ email }) => {
      await auth.login(email.trim() || undefined)
      // Браузер уже уходит на страницу Keycloak: промис не завершается, форма остаётся в состоянии «Входим…».
      return new Promise<Profile>(() => undefined)
    },
    getProfile: (role) => {
      const user = auth.currentUser()
      return user && role !== 'guest' ? Promise.resolve(profileOf(user)) : fallback.getProfile(role)
    },
  }
}

export const withOidcSession = (services: Services): Services => ({ ...services, session: oidcSession(services.session) })
