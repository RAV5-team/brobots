import { Check, Minus } from 'lucide-react'
import { ActionButton, ActionLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { ru } from '@/shared/i18n/ru'
import { LoginCard } from './LoginLayout'

/** В SPA демо открывается действием (роль гостя, переход), в теме Keycloak — переходом по адресу приложения. */
type DemoOfferCardProps = { readonly onOpenDemo: () => void } | { readonly openDemoHref: string }

/** Левая карточка экрана 05: вход гостя без регистрации (PRD 4; D-14; 15935:32). */
export function DemoOfferCard(props: DemoOfferCardProps) {
  const t = ru.login.demo

  return (
    <LoginCard labelledBy="login-demo-title">
      <p className="type-overline text-text-muted">{t.eyebrow}</p>
      <h2 id="login-demo-title" className="type-display-md text-text">
        {t.title}
      </h2>
      <p className="type-body text-text-secondary">{t.lead}</p>

      <Card as="ul" variant="accent" padding={16} aria-label={t.featuresLabel}>
        {t.features.map((feature) => (
          <li key={feature} className="flex items-center gap-12 py-4 type-body text-text">
            <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-full bg-accent-surface shadow-accent-raised">
              <Check size={12} strokeWidth={2.5} />
            </span>
            {feature}
          </li>
        ))}
        <li className="flex items-center gap-12 py-4 type-body text-on-accent">
          <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-full bg-accent-surface shadow-accent-inset">
            <Minus size={12} />
          </span>
          {t.unavailable}
          <span className="sr-only"> — {t.unavailableHint}</span>
        </li>
      </Card>

      {/* Кнопка прижата к низу карточки, как в макете: высота карточек выравнивается по правой. */}
      {'openDemoHref' in props ? (
        <ActionLink className="mt-auto" href={props.openDemoHref}>{t.open}</ActionLink>
      ) : (
        <ActionButton className="mt-auto" onClick={props.onOpenDemo}>{t.open}</ActionButton>
      )}
    </LoginCard>
  )
}
