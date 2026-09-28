import { useRef, useState, type SubmitEvent } from 'react'
import { ActionButton } from '@/components/ui/ActionButton'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { InvalidCredentialsError, type Credentials } from '@/services'
import type { Profile } from '@/domain'
import type { DemoAccount } from '@/shared/auth/demoAccounts'
import { ru } from '@/shared/i18n/ru'
import { DemoAccessList } from './DemoAccessList'
import { validateLogin, type LoginErrors } from './loginForm'

interface SignInCardProps {
  readonly demoAccounts: readonly DemoAccount[]
  readonly signIn: (credentials: Credentials) => Promise<Profile>
  readonly onSignedIn: (profile: Profile) => void
  /** Вход через Keycloak: без поля пароля, почта уходит подсказкой на страницу входа. */
  readonly passwordless?: boolean
}

const EMPTY: Credentials = { email: '', password: '' }

/** Правая карточка экрана 05: вход пользователя и администратора по приглашению (PRD 4; 15935:73). */
export function SignInCard({ demoAccounts, signIn, onSignedIn, passwordless = false }: SignInCardProps) {
  const t = ru.login.cabinet
  const [values, setValues] = useState<Credentials>(EMPTY)
  const [errors, setErrors] = useState<LoginErrors>({})
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

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateLogin(values, { passwordless })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    try {
      onSignedIn(await signIn({ email: values.email.trim(), password: values.password }))
    } catch (error: unknown) {
      const message = error instanceof InvalidCredentialsError ? ru.login.errors.invalidCredentials : ru.login.errors.unavailable
      setErrors({ password: message })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card padding={28} gap={20} className="flex-1" aria-labelledby="login-cabinet-title">
      <p className="type-overline text-text-muted">{t.eyebrow}</p>
      <h2 id="login-cabinet-title" className="type-display-md text-text">
        {t.title}
      </h2>
      <p className="type-body text-text-secondary">{t.lead}</p>

      <DemoAccessList accounts={demoAccounts} onPick={pickDemo} />

      <form noValidate className="flex flex-1 flex-col gap-20" onSubmit={(e) => { void submit(e) }}>
        <Field label={t.email} labelVariant="overline" error={errors.email}>
          <Input
            size="lg"
            type="email"
            autoComplete="username"
            placeholder={t.emailPlaceholder}
            value={values.email}
            onChange={(e) => { update('email', e.target.value) }}
          />
        </Field>
        {passwordless ? (
          <p className="type-caption text-text-muted">{t.passwordlessHint}</p>
        ) : (
          <Field label={t.password} labelVariant="overline" error={errors.password}>
            <Input
              size="lg"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(e) => { update('password', e.target.value) }}
            />
          </Field>
        )}
        <ActionButton ref={submitRef} type="submit" tone="strong" className="mt-auto" disabled={pending} aria-busy={pending}>
          {pending ? t.submitting : t.submit}
        </ActionButton>
      </form>
    </Card>
  )
}
