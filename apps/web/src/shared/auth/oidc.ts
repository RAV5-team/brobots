import type Keycloak from 'keycloak-js'
import type { Role } from '@/domain'
import { setAccessTokenProvider } from './accessToken'
import { ru } from '@/shared/i18n/ru'

/** Realm Keycloak: `http://localhost/auth/realms/rav5`. Пусто — вход без Keycloak (гость, dev-режим api). */
const OIDC_URL = (import.meta.env.VITE_OIDC_URL ?? '').replace(/\/+$/, '')
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || 'rav5-web'

export const OIDC_ENABLED = OIDC_URL !== ''

/** Токен обновляется, если жить ему осталось меньше этого, с. */
const MIN_TOKEN_VALIDITY_S = 30

/** Вошедший пользователь по access token Keycloak. */
export interface AuthUser {
  readonly name: string
  readonly email: string | null
  /** guest — учётке не назначена ни user, ни admin: вход есть, прав нет (ролевая модель, §1). */
  readonly role: Role
}

interface TokenClaims {
  readonly name?: string
  readonly preferred_username?: string
  readonly email?: string
  readonly realm_access?: { readonly roles?: readonly string[] }
}

/** `…/auth/realms/rav5` → адрес Keycloak и realm для keycloak-js. */
export function parseRealmUrl(url: string): { readonly url: string; readonly realm: string } {
  const match = /^(.*)\/realms\/([^/]+)$/u.exec(url)
  if (!match?.[1] || !match[2]) throw new Error(`VITE_OIDC_URL: ожидается адрес realm вида https://host/auth/realms/rav5, получено «${url}»`)
  return { url: match[1], realm: match[2] }
}

/**
 * Роль платформы по ролям realm (PRD 4): admin важнее user. Учётка без этих ролей — гость: сервис не даст ей писать
 * (403), так что кабинет ей не показывается (ролевая модель, §1).
 */
export function roleFromClaims(claims: TokenClaims): AuthUser['role'] {
  const roles = claims.realm_access?.roles ?? []
  if (roles.includes('admin')) return 'admin'
  return roles.includes('user') ? 'user' : 'guest'
}

export function userFromClaims(claims: TokenClaims): AuthUser {
  const email = claims.email ?? null
  return { name: claims.name || claims.preferred_username || email || ru.roles.user, email, role: roleFromClaims(claims) }
}

let keycloak: Keycloak | null = null
let user: AuthUser | null = null

/**
 * Проверить сессию Keycloak без перехода на страницу входа (check-sso, PKCE S256) — до первого рендера.
 * Keycloak недоступен — приложение открывается гостем, ошибка в консоли.
 */
export async function initAuth(): Promise<AuthUser | null> {
  if (!OIDC_ENABLED) return null
  const { default: KeycloakClient } = await import('keycloak-js')
  const client = new KeycloakClient({ ...parseRealmUrl(OIDC_URL), clientId: OIDC_CLIENT_ID })
  try {
    const authenticated = await client.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    })
    keycloak = client
    user = authenticated && client.tokenParsed ? userFromClaims(client.tokenParsed) : null
  } catch (error: unknown) {
    console.error('Keycloak не ответил — вход недоступен, открыт гостевой режим', error)
    return null
  }
  setAccessTokenProvider(async () => {
    if (!client.authenticated) return null
    try {
      await client.updateToken(MIN_TOKEN_VALIDITY_S)
    } catch {
      await client.login()
      return null
    }
    return client.token ?? null
  })
  return user
}

export const currentUser = (): AuthUser | null => user

/** На страницу входа Keycloak; после входа — обратно на дашборд. */
export async function login(loginHint?: string): Promise<void> {
  if (!keycloak) throw new Error('Вход через Keycloak недоступен')
  await keycloak.login({ redirectUri: `${window.location.origin}/`, ...(loginHint ? { loginHint } : {}) })
}

/** Завершить сессию Keycloak и вернуться на экран входа. */
export async function logout(): Promise<void> {
  if (!keycloak) return
  await keycloak.logout({ redirectUri: `${window.location.origin}/login` })
}
