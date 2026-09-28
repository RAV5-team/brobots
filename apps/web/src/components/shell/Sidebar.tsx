import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { useNewProjectLink } from '@/components/newProject/useNewProjectLink'
import type { DataVersion, Profile, Role } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { NavLinkItem } from './NavLinkItem'
import { navItemsFor, type NavKey } from './navigation'
import { UserMenu } from './UserMenu'

export interface SidebarProps {
  readonly role: Role
  readonly activeKey: NavKey | null
  /** Счётчики пунктов; нет ключа — счётчик не показывается. */
  readonly counts: Readonly<Partial<Record<NavKey, number>>>
  readonly profile: Profile | null
  readonly dataVersion: DataVersion | null
}

/** Левое меню — один компонент с вариантами по роли (D-01; эталон 15935:207). */
export function Sidebar({ role, activeKey, counts, profile, dataVersion }: SidebarProps) {
  const isGuest = role === 'guest'
  // Пользователь и администратор открывают окно A2 поверх текущей страницы; гость — демо-проект (D-26, D-84).
  const newProjectLink = useNewProjectLink()()

  return (
    <aside aria-label={ru.shell.sidebar} className="sticky top-0 flex h-screen w-sidebar shrink-0 flex-col gap-16 rounded-r-3xl border border-highlight bg-bg px-16 py-20 shadow-raised-lg">
      <div className="flex flex-col">
        <span className="type-heading text-text">{ru.app.name}</span>
        <span className="type-caption-xs uppercase text-text-secondary">{ru.app.tagline}</span>
      </div>

      <Link
        to={isGuest ? ROUTE_PATHS.projects : newProjectLink}
        {...(isGuest ? {} : { 'aria-haspopup': 'dialog' as const })}
        className={clsx(
          'flex h-48 items-center justify-between gap-8 rounded-full border border-highlight bg-bg py-8 pr-16 font-medium whitespace-nowrap text-text shadow-raised-sm transition-shadow hover:shadow-raised-md active:shadow-inset-sm',
          // «Открыть демо-проект» не помещается в 14 px при отступе 20 — как в макете гостя, плотнее (D-26).
          isGuest ? 'pl-12 type-body-sm' : 'pl-20 type-body',
        )}
      >
        {isGuest ? ru.nav.guestNewProject : ru.nav.newProject}
        <span className="flex size-36 items-center justify-center rounded-full bg-bg shadow-raised-sm">
          <Plus aria-hidden size={16} strokeWidth={2.5} />
        </span>
      </Link>

      <nav aria-label={ru.shell.mainNavigation} className="flex flex-col gap-4">
        <span className="type-overline text-text-muted">{ru.nav.sections}</span>
        <ul className="flex flex-col gap-4">
          {navItemsFor(role).map((item) => (
            <li key={item.key}>
              <NavLinkItem item={item} count={counts[item.key]} active={item.key === activeKey} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1" />

      {profile && <UserMenu profile={profile} dataVersion={dataVersion} />}
    </aside>
  )
}
