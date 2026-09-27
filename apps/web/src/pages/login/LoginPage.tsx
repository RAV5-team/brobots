import { useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { BackLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import type { Profile } from '@/domain'
import { useServices } from '@/services/useServices'
import { DEMO_ACCOUNTS, type DemoAccount } from '@/shared/auth/demoAccounts'
import { useSwitchRole } from '@/shared/auth/useSwitchRole'
import { ru } from '@/shared/i18n/ru'
import { DemoOfferCard } from './DemoOfferCard'
import { SignInCard } from './SignInCard'

// Публичного сайта пока нет: без адреса в окружении ссылка ведёт на главную (D-28).
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || '/'

interface LoginPageProps {
  /** Демо-учётки; по умолчанию — из окружения, пусто вне демо-сборки (D-16). */
  readonly demoAccounts?: readonly DemoAccount[]
}

/** Экран 05 «Вход · авторизация» (PRD 4; 15935:17). Без каркаса кабинета и без ?as=. */
export function LoginPage({ demoAccounts = DEMO_ACCOUNTS }: LoginPageProps) {
  const { session } = useServices()
  const switchRole = useSwitchRole()
  const navigate = useNavigate()

  const enter = (role: Profile['role']) => {
    switchRole(role)
    void navigate(ROUTE_PATHS.dashboard)
  }

  return (
    <main className="min-h-screen bg-bg px-16 pt-48 pb-48 md:px-40">
      <title>{ru.login.documentTitle}</title>
      <div className="mx-auto flex w-full max-w-(--rav-login-width) flex-col gap-40">
        <header className="flex items-center justify-between gap-16">
          <BackLink href={PUBLIC_SITE_URL}>{ru.login.publicSite}</BackLink>
          <Logo />
        </header>

        <h1 className="type-display-lg text-text md:type-display-xl">{ru.login.title}</h1>

        <Card as="div" padding={28} gap={28} className="md:flex-row">
          <DemoOfferCard onOpenDemo={() => { enter('guest') }} />
          <SignInCard demoAccounts={demoAccounts} signIn={(credentials) => session.signIn(credentials)} onSignedIn={(profile) => { enter(profile.role) }} />
        </Card>
      </div>
    </main>
  )
}
