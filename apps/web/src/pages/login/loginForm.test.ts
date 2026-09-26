import { describe, expect, it } from 'vitest'
import { ru } from '@/shared/i18n/ru'
import { validateLogin } from './loginForm'

const t = ru.login.errors

describe('validateLogin (ТЗ 4.5.4: ошибка со способом исправления)', () => {
  it('asks for both fields when the form is empty', () => {
    expect(validateLogin({ email: '  ', password: '' })).toEqual({ email: t.emailRequired, password: t.passwordRequired })
  })

  it('rejects an address without a domain', () => {
    expect(validateLogin({ email: 'demo@rav5', password: 'x' })).toEqual({ email: t.emailInvalid })
  })

  it('accepts a work email with spaces around it', () => {
    expect(validateLogin({ email: ' name@company.ru ', password: 'x' })).toEqual({})
  })
})
