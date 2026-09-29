import { ActionLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { TextAnchor } from '@/components/ui/TextAnchor'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'

const t = ru.login.pageExpired

/** Истёкшая страница входа (login-page-expired.ftl): начать заново или продолжить с того же шага. */
export function LoginPageExpired({ kcContext }: { readonly kcContext: PageContext<'login-page-expired.ftl'> }) {
  const { url } = kcContext
  return (
    <Template kcContext={kcContext} title={t.title}>
      <Card padding={28} gap={20} aria-label={t.title}>
        <p className="type-body text-text-secondary">{t.lead}</p>
        <ActionLink tone="strong" href={url.loginRestartFlowUrl}>{t.restart}</ActionLink>
        <TextAnchor href={url.loginAction} className="self-start">{t.proceed}</TextAnchor>
      </Card>
    </Template>
  )
}
