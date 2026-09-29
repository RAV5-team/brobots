import { ActionLink, BackLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { ru } from '@/shared/i18n/ru'
import type { I18n } from '../i18n'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'
import { appUrl } from '../themeLinks'

/** Сообщение Keycloak с продолжением (info.ftl): требуемые действия, ссылка дальше или обратно в RAV5. */
export function Info({ kcContext, i18n }: { readonly kcContext: PageContext<'info.ftl'>; readonly i18n: I18n }) {
  const { message, messageHeader, requiredActions, skipLink, pageRedirectUri, actionUri } = kcContext
  const next = actionUri ?? pageRedirectUri
  const actions = requiredActions?.map((action) => i18n.advancedMsgStr(`requiredAction.${action}`)).join(', ')

  return (
    <Template kcContext={kcContext} title={messageHeader ?? ru.login.info.title} displayMessage={false}>
      <Card padding={28} gap={20} aria-label={messageHeader ?? ru.login.info.title}>
        <p className="type-body text-text">
          {message.summary}
          {actions && `: ${actions}`}
        </p>
        {!skipLink && (next ? (
          <ActionLink tone="strong" href={next}>{ru.login.info.proceed}</ActionLink>
        ) : (
          <BackLink href={appUrl(kcContext)}>{ru.login.backToApp}</BackLink>
        ))}
      </Card>
    </Template>
  )
}
