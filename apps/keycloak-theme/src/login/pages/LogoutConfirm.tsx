import { ActionButton, BackLink } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'
import { appUrl } from '../themeLinks'

const t = ru.login.logoutConfirm

/** Подтверждение выхода (logout-confirm.ftl): форма с кодом сессии на logoutConfirmAction. */
export function LogoutConfirm({ kcContext }: { readonly kcContext: PageContext<'logout-confirm.ftl'> }) {
  const { url, logoutConfirm } = kcContext
  return (
    <Template kcContext={kcContext} title={t.title}>
      <Card padding={28} gap={20} aria-label={t.title}>
        <p className="type-body text-text-secondary">{t.lead}</p>
        <form action={url.logoutConfirmAction} method="post" className="flex flex-col gap-20">
          <input type="hidden" name="session_code" value={logoutConfirm.code} />
          <ActionButton type="submit" tone="strong" name="confirmLogout" value="true">{t.submit}</ActionButton>
        </form>
        {!logoutConfirm.skipLink && <BackLink href={appUrl(kcContext)} className="self-start">{ru.login.backToApp}</BackLink>}
      </Card>
    </Template>
  )
}
