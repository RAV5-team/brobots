import type { ReactNode } from 'react'
import { BackLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { ru } from '@/shared/i18n/ru'

interface LoginLayoutProps {
  readonly title: string
  /** «Публичный сайт RAV5» (D-28). */
  readonly publicSiteUrl: string
  readonly children: ReactNode
}

/**
 * Каркас экрана 05 (PRD 4; 15935:17): шапка со ссылкой на публичный сайт и логотипом, крупный заголовок.
 * Общий для SPA (LoginPage) и темы входа Keycloak (apps/keycloak-theme) — экраны не расходятся.
 */
export function LoginLayout({ title, publicSiteUrl, children }: LoginLayoutProps) {
  return (
    <main className="min-h-screen bg-bg px-16 pt-48 pb-48 md:px-40">
      <div className="mx-auto flex w-full max-w-(--rav-login-width) flex-col gap-40">
        <header className="flex items-center justify-between gap-16">
          <BackLink href={publicSiteUrl}>{ru.login.publicSite}</BackLink>
          <Logo />
        </header>

        <h1 className="type-display-lg text-text md:type-display-xl">{title}</h1>

        {children}
      </div>
    </main>
  )
}

/**
 * Панель с двумя карточками экрана 05: демо и вход в кабинет (15935:31). Уже 768 px карточки встают друг под другом,
 * а отступы панели и карточек уменьшаются: вложенные 28 + 28 оставляли тексту на 320 px около 170 px.
 */
export function LoginCards({ children }: { readonly children: ReactNode }) {
  return (
    <Card as="div" padding={28} gap={28} className="md:flex-row max-md:gap-20 max-md:p-12">
      {children}
    </Card>
  )
}

interface LoginCardProps {
  /** id заголовка карточки — её доступное имя. */
  readonly labelledBy: string
  readonly children: ReactNode
}

/** Карточка на панели экрана 05 (15935:32, 15935:73). */
export function LoginCard({ labelledBy, children }: LoginCardProps) {
  return (
    <Card padding={28} gap={20} className="flex-1 max-md:p-20" aria-labelledby={labelledBy}>
      {children}
    </Card>
  )
}
