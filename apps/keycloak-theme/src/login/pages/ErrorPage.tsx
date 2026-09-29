import { BackLink } from '@/components/ui/ActionButton'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'
import { appUrl } from '../themeLinks'

/** Ошибка входа (error.ftl): текст Keycloak плашкой и возврат в RAV5. */
export function ErrorPage({ kcContext }: { readonly kcContext: PageContext<'error.ftl'> }) {
  return (
    <Template kcContext={kcContext} title={ru.login.error.title}>
      {!kcContext.skipLink && <BackLink href={appUrl(kcContext)} className="self-start">{ru.login.backToApp}</BackLink>}
    </Template>
  )
}
