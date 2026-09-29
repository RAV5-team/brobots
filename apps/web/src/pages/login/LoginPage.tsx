import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import type { Profile } from '@/domain'
import { useServices } from '@/services/useServices'
import { DEMO_ACCOUNTS, type DemoAccount } from '@/shared/auth/demoAccounts'
import { OIDC_ENABLED, login } from '@/shared/auth/oidc'
import { useSwitchRole } from '@/shared/auth/useSwitchRole'
import { ru } from '@/shared/i18n/ru'
import { DemoOfferCard } from './DemoOfferCard'
import { LoginCards, LoginLayout } from './LoginLayout'
import { SignInCard } from './SignInCard'

// Публичного сайта пока нет: без адреса в окружении ссылка ведёт на главную (D-28).
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || '/'

interface LoginPageProps {
  /** Демо-учётки; по умолчанию — из окружения, пусто вне демо-сборки (D-16). */
  readonly demoAccounts?: readonly DemoAccount[]
  /** Вход через Keycloak: экран 05 рисует его тема rav5 (apps/keycloak-theme), здесь — только переход. null — без Keycloak. */
  readonly keycloakLogin?: (() => Promise<void>) | null
}

/**
 * Экран 05 «Вход · авторизация» (PRD 4; 15935:17). Без каркаса кабинета и без ?as=.
 * С Keycloak сразу уводит на его страницу входа; не вышло (Keycloak недоступен) — показывает экран с демо.
 */
export function LoginPage({ demoAccounts = DEMO_ACCOUNTS, keycloakLogin = OIDC_ENABLED ? login : null }: LoginPageProps) {
  const { session } = useServices()
  const switchRole = useSwitchRole()
  const navigate = useNavigate()
  const [redirectFailed, setRedirectFailed] = useState(false)
  // StrictMode вызывает эффект дважды — переход на Keycloak нужен один.
  const redirectStarted = useRef(false)

  useEffect(() => {
    if (!keycloakLogin || redirectStarted.current) return
    redirectStarted.current = true
    keycloakLogin().catch((error: unknown) => {
      console.error('Не удалось перейти на страницу входа Keycloak — открыт экран входа с демо', error)
      setRedirectFailed(true)
    })
  }, [keycloakLogin])

  const enter = (role: Profile['role']) => {
    switchRole(role)
    void navigate(ROUTE_PATHS.dashboard)
  }

  if (keycloakLogin && !redirectFailed) {
    return (
      <main className="min-h-screen bg-bg px-16 pt-48 pb-48 md:px-40">
        <title>{ru.login.documentTitle}</title>
        <p role="status" className="type-body text-text-muted">{ru.login.redirecting}</p>
      </main>
    )
  }

  return (
    <LoginLayout title={ru.login.title} publicSiteUrl={PUBLIC_SITE_URL}>
      <title>{ru.login.documentTitle}</title>
      <LoginCards>
        <DemoOfferCard onOpenDemo={() => { enter('guest') }} />
        <SignInCard
          demoAccounts={demoAccounts}
          signIn={(credentials) => session.signIn(credentials)}
          onSignedIn={(profile) => { enter(profile.role) }}
        />
      </LoginCards>
    </LoginLayout>
  )
}
