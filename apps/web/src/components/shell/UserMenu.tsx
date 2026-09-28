import { clsx } from 'clsx'
import { ChevronUp } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import type { DataVersion, Profile } from '@/domain'
import { logout, OIDC_ENABLED } from '@/shared/auth/oidc'
import { ru } from '@/shared/i18n/ru'

interface UserMenuProps {
  readonly profile: Profile
  readonly dataVersion: DataVersion | null
}

/**
 * Блок пользователя и меню кабинета (PRD 5.2; 15935:236, 15935:244).
 * Раскрывающийся список ссылок: Esc и клик мимо закрывают, фокус возвращается на кнопку.
 */
export function UserMenu({ profile, dataVersion }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const caption = ru.roleCaptions[profile.role]
  const close = () => { setOpen(false) }

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          id={panelId}
          className="absolute bottom-[calc(100%-var(--rav-space-4))] left-8 z-10 w-[300px] rounded-xl bg-bg py-8 shadow-raised-lg"
        >
          {profile.role === 'guest' ? (
            <GuestMenu onNavigate={close} />
          ) : (
            <CabinetMenu profile={profile} dataVersion={dataVersion} onNavigate={close} />
          )}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${ru.shell.openCabinetMenu}: ${profile.name}`}
        onClick={() => { setOpen((v) => !v) }}
        className="flex w-full items-center gap-12 rounded-md bg-surface-muted p-12 text-left shadow-inset-md transition-colors hover:bg-surface-sunken"
      >
        <span className="flex size-32 shrink-0 items-center justify-center rounded-full bg-surface-sunken type-caption font-semibold text-text">
          {profile.initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-body font-semibold text-text">{profile.name}</span>
          <span className="type-caption text-text-secondary">{caption}</span>
        </span>
        {/* Меню раскрывается вверх — шеврон «вверх» в обоих состояниях, как в макете. */}
        <ChevronUp aria-hidden size={16} className="shrink-0 text-text" />
      </button>
    </div>
  )
}

function CabinetMenu({ profile, dataVersion, onNavigate }: UserMenuProps & { readonly onNavigate: () => void }) {
  return (
    <ul className="flex flex-col">
      <li className="flex flex-col gap-4 px-20 py-12">
        <span className="type-body font-semibold text-text">{profile.name}</span>
        <span className="type-caption text-text-muted">{[profile.email, profile.organization].filter(Boolean).join(' · ')}</span>
      </li>
      <Divider />
      <MenuLink to={ROUTE_PATHS.profile} onNavigate={onNavigate}>{ru.cabinetMenu.profile}</MenuLink>
      <li className="flex flex-col gap-4 px-20 py-12">
        <span className="type-body font-semibold text-text">{ru.cabinetMenu.dataVersion}</span>
        <span className="type-caption text-text-muted">{dataVersion ? ru.dataVersion.full(dataVersion) : '—'}</span>
      </li>
      <MenuLink to={ROUTE_PATHS.help} onNavigate={onNavigate}>{ru.cabinetMenu.help}</MenuLink>
      <Divider />
      {/* С Keycloak выход завершает его сессию, и он сам вернёт на экран входа. */}
      <MenuLink to={ROUTE_PATHS.login} onNavigate={OIDC_ENABLED ? () => { void logout() } : onNavigate} danger>
        {ru.cabinetMenu.logout}
      </MenuLink>
    </ul>
  )
}

/** У гостя нет кабинета: справка и вход (D-26). */
function GuestMenu({ onNavigate }: { readonly onNavigate: () => void }) {
  return (
    <ul className="flex flex-col">
      <MenuLink to={ROUTE_PATHS.help} onNavigate={onNavigate}>{ru.cabinetMenu.help}</MenuLink>
      <Divider />
      <MenuLink to={ROUTE_PATHS.login} onNavigate={onNavigate}>{ru.cabinetMenu.login}</MenuLink>
    </ul>
  )
}

const MENU_ITEM = 'flex h-40 items-center px-20 type-body font-semibold transition-colors hover:bg-surface-sunken'

function MenuLink({ to, children, danger = false, onNavigate }: { to: string; children: ReactNode; danger?: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        to={to}
        onClick={onNavigate}
        className={clsx(MENU_ITEM, danger ? 'text-danger' : 'text-text')}
      >
        {children}
      </Link>
    </li>
  )
}

function Divider() {
  return <li aria-hidden className="h-px bg-border" />
}
