import type { Credentials } from '@/services'
import { ru } from '@/shared/i18n/ru'

export type LoginErrors = Partial<Record<keyof Credentials, string>>

// Достаточно для подсказки в форме; настоящую проверку делает сервис входа.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Проверка формы входа до отправки: пустые поля и формат почты. */
export function validateLogin({ email, password }: Credentials): LoginErrors {
  const trimmed = email.trim()
  const emailError = trimmed === '' ? ru.login.errors.emailRequired : EMAIL_PATTERN.test(trimmed) ? undefined : ru.login.errors.emailInvalid
  return {
    ...(emailError && { email: emailError }),
    ...(password === '' && { password: ru.login.errors.passwordRequired }),
  }
}
