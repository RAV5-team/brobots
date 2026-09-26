import { isRole, type Role } from '@/domain'

export const ROLE_QUERY_PARAM = 'as'

interface RoleInput {
  /** location.search текущей страницы. */
  readonly search: string
  /** Значение из sessionStorage (может быть испорчено). */
  readonly stored: string | null
  /** ?as= работает только в dev-режиме или при DEMO_MODE (D-16). */
  readonly allowUrlRole: boolean
  /** Роль без ?as= и без сохранённой: user в dev, guest в сборке (D-24). */
  readonly fallback: Role
}

interface RoleResolution {
  readonly role: Role
  /** Что сохранить в sessionStorage; null — ничего не менять. */
  readonly persist: Role | null
}

/** Роль текущей сессии: ?as= → сохранённая в сессии → роль по умолчанию. */
export function resolveRole({ search, stored, allowUrlRole, fallback }: RoleInput): RoleResolution {
  if (!allowUrlRole) return { role: fallback, persist: null }
  const fromUrl = new URLSearchParams(search).get(ROLE_QUERY_PARAM)
  if (isRole(fromUrl)) return { role: fromUrl, persist: fromUrl }
  return { role: isRole(stored) ? stored : fallback, persist: null }
}

/** Разделы, закрытые для роли (PRD 5.3): гостю — интеграции, администрирование и кабинет. */
const DENIED_PREFIXES: Record<Role, readonly string[]> = {
  guest: ['/integrations', '/admin', '/profile'],
  user: ['/admin'],
  admin: [],
}

export function canAccess(role: Role, path: string): boolean {
  return !DENIED_PREFIXES[role].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
