import { ROUTE_PATHS } from '@/app/routePaths'
import type { Role } from '@/domain'
import { ru } from '@/shared/i18n/ru'

export type NavKey = 'dashboard' | 'projects' | 'processes' | 'locations' | 'catalog' | 'integrations' | 'admin'

export interface NavItem {
  readonly key: NavKey
  readonly label: string
  readonly to: string
}

const item = (key: NavKey, label: string, to: string): NavItem => ({ key, label, to })

const CABINET: readonly NavItem[] = [
  item('dashboard', ru.nav.dashboard, ROUTE_PATHS.dashboard),
  item('projects', ru.nav.projects, ROUTE_PATHS.projects),
  item('processes', ru.nav.processes, ROUTE_PATHS.processes),
  item('locations', ru.nav.locations, ROUTE_PATHS.locations),
  item('catalog', ru.nav.catalog, ROUTE_PATHS.catalog),
  item('integrations', ru.nav.integrations, ROUTE_PATHS.integrations),
]

/** Пункты левого меню по роли: кабинет (PRD 5.1), + «Администрирование» у админа, меню гостя (ролевая модель, §3). */
export function navItemsFor(role: Role): readonly NavItem[] {
  switch (role) {
    case 'admin':
      return [...CABINET, item('admin', ru.nav.admin, ROUTE_PATHS.adminCatalog)]
    case 'user':
      return CABINET
    case 'guest':
      // Ролевая модель, §3: демо-данные организатора без интеграций и администрирования.
      return [
        item('dashboard', ru.nav.dashboard, ROUTE_PATHS.dashboard),
        item('projects', ru.nav.guestProjects, ROUTE_PATHS.projects),
        item('processes', ru.nav.processes, ROUTE_PATHS.processes),
        item('locations', ru.nav.locations, ROUTE_PATHS.locations),
        item('catalog', ru.nav.catalog, ROUTE_PATHS.catalog),
      ]
  }
}

const SECTION_PREFIXES: readonly (readonly [string, NavKey])[] = [
  ['/projects', 'projects'],
  ['/processes', 'processes'],
  ['/locations', 'locations'],
  ['/catalog', 'catalog'],
  ['/integrations', 'integrations'],
  ['/admin', 'admin'],
]

/** Активный пункт меню по адресу; null — страница вне разделов меню (профиль, справка). */
export function activeNavKey(pathname: string): NavKey | null {
  if (pathname === ROUTE_PATHS.dashboard) return 'dashboard'
  const match = SECTION_PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return match ? match[1] : null
}
