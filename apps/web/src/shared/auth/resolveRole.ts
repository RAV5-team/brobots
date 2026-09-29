import { matchPath } from 'react-router'
import { isRole, type Role } from '@/domain'

export const ROLE_QUERY_PARAM = 'as'

interface RoleInput {
  /** location.search текущей страницы. */
  readonly search: string
  /** Значение из sessionStorage (может быть испорчено). */
  readonly stored: string | null
  /** ?as= работает только в dev-режиме: в сборке роль — только из токена (ролевая модель, §2). */
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

/**
 * Разделы, закрытые для роли (ролевая модель, §3): гостю — формы создания, интеграции, кабинет и администрирование;
 * пользователю — администрирование. Недоступное скрыто в меню, а прямая ссылка ведёт на «нет доступа».
 */
const DENIED_PATTERNS: Record<Role, readonly string[]> = {
  guest: ['/processes/new', '/locations/new', '/integrations/*', '/profile/*', '/admin/*'],
  user: ['/admin/*'],
  admin: [],
}

export function canAccess(role: Role, path: string): boolean {
  return !DENIED_PATTERNS[role].some((pattern) => matchPath(pattern, path) !== null)
}
