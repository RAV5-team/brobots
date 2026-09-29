import { ActionButton } from '@/components/ui/ActionButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'

const t = ru.login.updatePassword

/** Смена пароля по требованию Keycloak (временный пароль от администратора): login-update-password.ftl. */
export function LoginUpdatePassword({ kcContext }: { readonly kcContext: PageContext<'login-update-password.ftl'> }) {
  const { url, messagesPerField, isAppInitiatedAction } = kcContext
  const errorOf = (name: string) => (messagesPerField.existsError(name) ? messagesPerField.get(name) : undefined)

  return (
    <Template kcContext={kcContext} title={t.title}>
      <Card padding={28} gap={20} aria-label={t.title}>
        <p className="type-body text-text-secondary">{t.lead}</p>
        <form id="kc-passwd-update-form" action={url.loginAction} method="post" className="flex flex-col gap-20">
          <Field label={t.password} labelVariant="overline" required error={errorOf('password')}>
            <Input size="lg" type="password" name="password-new" autoComplete="new-password" />
          </Field>
          <Field label={t.passwordConfirm} labelVariant="overline" required error={errorOf('password-confirm')}>
            <Input size="lg" type="password" name="password-confirm" autoComplete="new-password" />
          </Field>
          <ActionButton type="submit" tone="strong">{t.submit}</ActionButton>
          {isAppInitiatedAction && (
            <Button type="submit" name="cancel-aia" value="true">{t.cancel}</Button>
          )}
        </form>
      </Card>
    </Template>
  )
}
