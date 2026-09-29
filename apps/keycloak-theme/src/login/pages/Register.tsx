import { useState } from 'react'
import { ActionButton } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { TextAnchor } from '@/components/ui/TextAnchor'
import { ru } from '@/shared/i18n/ru'
import type { I18n } from '../i18n'
import type { PageContext } from '../KcContext'
import { formAttributes } from '../pageSupport'
import { Template } from '../Template'

const t = ru.login.register

/** Подписи стандартных атрибутов профиля; остальные — из профиля Keycloak. */
const LABELS: Readonly<Record<string, string>> = { email: t.email, firstName: t.firstName, lastName: t.lastName }
const AUTOCOMPLETE: Readonly<Record<string, string>> = { email: 'email', firstName: 'given-name', lastName: 'family-name' }

/** Регистрация (register.ftl): имена полей — атрибуты профиля Keycloak, пароль — password и password-confirm. */
export function Register({ kcContext, i18n }: { readonly kcContext: PageContext<'register.ftl'>; readonly i18n: I18n }) {
  const { url, messagesPerField, passwordRequired } = kcContext
  const [pending, setPending] = useState(false)
  const errorOf = (name: string) => (messagesPerField.existsError(name) ? messagesPerField.get(name) : undefined)

  return (
    <Template kcContext={kcContext} title={t.title} documentTitle={t.documentTitle}>
      <Card padding={28} gap={20} aria-label={t.title}>
        <p className="type-body text-text-secondary">{t.lead}</p>
        <form
          id="kc-register-form"
          action={url.registrationAction}
          method="post"
          className="flex flex-col gap-20"
          onSubmit={() => { setPending(true) }}
        >
          {formAttributes(kcContext).map((attribute) => (
            <Field
              key={attribute.name}
              label={LABELS[attribute.name] ?? i18n.advancedMsgStr(attribute.displayName ?? attribute.name)}
              labelVariant="overline"
              required={attribute.required}
              error={errorOf(attribute.name)}
            >
              <Input
                size="lg"
                name={attribute.name}
                type={attribute.name === 'email' ? 'email' : 'text'}
                autoComplete={AUTOCOMPLETE[attribute.name]}
                defaultValue={attribute.value ?? ''}
              />
            </Field>
          ))}
          {passwordRequired && (
            <>
              <Field label={t.password} labelVariant="overline" required error={errorOf('password')}>
                <Input size="lg" type="password" name="password" autoComplete="new-password" />
              </Field>
              <Field label={t.passwordConfirm} labelVariant="overline" required error={errorOf('password-confirm')}>
                <Input size="lg" type="password" name="password-confirm" autoComplete="new-password" />
              </Field>
            </>
          )}
          <ActionButton type="submit" tone="strong" disabled={pending} aria-busy={pending}>
            {t.submit}
          </ActionButton>
        </form>
        <p className="flex flex-wrap items-center gap-8 type-body text-text-secondary">
          {t.hasAccount}
          <TextAnchor href={url.loginUrl}>{t.toLogin}</TextAnchor>
        </p>
      </Card>
    </Template>
  )
}
