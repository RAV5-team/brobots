import { useRef, useState, type SubmitEvent } from 'react'
import { ActionButton } from '@/components/ui/ActionButton'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { TextAnchor } from '@/components/ui/TextAnchor'
import { DemoAccessList } from '@/pages/login/DemoAccessList'
import { LoginCard } from '@/pages/login/LoginLayout'
import { validateLogin, type LoginErrors } from '@/pages/login/loginForm'
import type { Credentials } from '@/services'
import type { DemoAccount } from '@/shared/auth/demoAccounts'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'

interface KcSignInCardProps {
  readonly kcContext: PageContext<'login.ftl'>
  readonly demoAccounts: readonly DemoAccount[]
}

/** Ошибка входа от Keycloak (неверный пароль, блокировка после перебора) — у поля пароля, как в SPA. */
function serverErrorOf({ messagesPerField }: PageContext<'login.ftl'>): string | undefined {
  return messagesPerField.existsError('username', 'password') ? messagesPerField.getFirstError('username', 'password') : undefined
}

interface SignInCheck {
  /** Keycloak уже знает пользователя (повторный вход) — поля почты нет. */
  readonly usernameHidden: boolean
  /** Почта служит логином (registrationEmailAsUsername) — проверяем её формат, как в SPA. */
  readonly emailIsLogin: boolean
}

/** Проверка формы до отправки. Логин не в виде почты (учётка из админки) проверяется только на пустоту. */
function checkSignIn(values: Credentials, { usernameHidden, emailIsLogin }: SignInCheck): LoginErrors {
  const { email, password } = validateLogin(values)
  const login = usernameHidden ? undefined : emailIsLogin ? email : values.email.trim() === '' ? ru.login.errors.loginRequired : undefined
  return { ...(login && { email: login }), ...(password && { password }) }
}

/**
 * Правая карточка экрана 05 (15935:73). Обычная HTML-форма на url.loginAction: пароль уходит только в Keycloak,
 * JS приложения его не видит. id формы и имена полей — как у стандартной темы.
 */
export function KcSignInCard({ kcContext, demoAccounts }: KcSignInCardProps) {
  const t = ru.login.cabinet
  const { url, realm, login, auth, usernameHidden = false, registrationDisabled } = kcContext
  const emailIsLogin = realm.registrationEmailAsUsername
  const [values, setValues] = useState<Credentials>({ email: login.username ?? '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>(() => {
    const serverError = serverErrorOf(kcContext)
    return serverError ? { password: serverError } : {}
  })
  const [rememberMe, setRememberMe] = useState(login.rememberMe === 'on')
  const [pending, setPending] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  const update = (key: keyof Credentials, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const pickDemo = (account: DemoAccount) => {
    setValues({ email: account.email, password: account.password })
    setErrors({})
    submitRef.current?.focus()
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    const found = checkSignIn(values, { usernameHidden, emailIsLogin })
    setErrors(found)
    if (Object.keys(found).length > 0) {
      event.preventDefault()
      return
    }
    // Форму отправляет браузер: страница уходит на ответ Keycloak.
    setPending(true)
  }

  return (
    <LoginCard labelledBy="login-cabinet-title">
      <p className="type-overline text-text-muted">{t.eyebrow}</p>
      <h2 id="login-cabinet-title" className="type-display-md text-text">
        {t.title}
      </h2>
      <p className="type-body text-text-secondary">{t.lead}</p>

      <DemoAccessList accounts={demoAccounts} onPick={pickDemo} />

      <form id="kc-form-login" action={url.loginAction} method="post" noValidate className="flex flex-1 flex-col gap-20" onSubmit={submit}>
        {!usernameHidden && (
          <Field label={emailIsLogin ? t.email : t.emailOrUsername} labelVariant="overline" error={errors.email}>
            <Input
              size="lg"
              type={emailIsLogin ? 'email' : 'text'}
              name="username"
              autoComplete="username"
              placeholder={emailIsLogin ? t.emailPlaceholder : undefined}
              value={values.email}
              onChange={(e) => { update('email', e.target.value) }}
            />
          </Field>
        )}
        <Field label={t.password} labelVariant="overline" error={errors.password}>
          <Input
            size="lg"
            type="password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => { update('password', e.target.value) }}
          />
        </Field>
        {realm.rememberMe && !usernameHidden && (
          <>
            <Checkbox label={t.rememberMe} checked={rememberMe} onCheckedChange={setRememberMe} />
            {rememberMe && <input type="hidden" name="rememberMe" value="on" />}
          </>
        )}
        <input type="hidden" name="credentialId" value={auth.selectedCredential ?? ''} />
        <ActionButton ref={submitRef} type="submit" tone="strong" className="mt-auto" disabled={pending} aria-busy={pending}>
          {pending ? t.submitting : t.submit}
        </ActionButton>
      </form>

      {realm.password && realm.registrationAllowed && !registrationDisabled && (
        <p className="flex flex-wrap items-center gap-8 type-body text-text-secondary">
          {t.noAccount}
          <TextAnchor href={url.registrationUrl}>{t.register}</TextAnchor>
        </p>
      )}
    </LoginCard>
  )
}
