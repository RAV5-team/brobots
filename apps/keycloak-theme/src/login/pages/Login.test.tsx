import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ru } from '@/shared/i18n/ru'
import { DEMO_PROPERTIES, getKcContextMock, mockFromSearch } from '../mocks'
import { Login } from './Login'

const t = ru.login
type LoginContext = ReturnType<typeof getKcContextMock<'login.ftl'>>

function renderLogin(context: LoginContext = getKcContextMock({ pageId: 'login.ftl' })) {
  render(<Login kcContext={context} />)
  const form = document.getElementById('kc-form-login')
  if (!(form instanceof HTMLFormElement)) throw new Error('нет формы kc-form-login')
  return form
}

describe('Login (экран 05 в теме Keycloak)', () => {
  it('posts username and password straight to Keycloak', () => {
    const form = renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { url: { loginAction: '/auth/realms/rav5/login-actions/authenticate?session_code=x' } } }))
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/auth/realms/rav5/login-actions/authenticate?session_code=x')
    expect(form.elements.namedItem('username')).toBeInstanceOf(HTMLInputElement)
    expect(form.elements.namedItem('password')).toBeInstanceOf(HTMLInputElement)
  })

  it('prefills the login hint', () => {
    renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { login: { username: 'anna@company.ru' } } }))
    expect(screen.getByLabelText(t.cabinet.email)).toHaveValue('anna@company.ru')
  })

  it('stops submission with empty fields and explains what to fix', () => {
    const form = renderLogin()
    // fireEvent возвращает false, если отправку отменили (preventDefault).
    expect(fireEvent.submit(form)).toBe(false)
    expect(screen.getByText(t.errors.emailRequired)).toBeInTheDocument()
    expect(screen.getByText(t.errors.passwordRequired)).toBeInTheDocument()
  })

  it('lets a valid form go to Keycloak and marks the button busy', () => {
    const form = renderLogin()
    fireEvent.change(screen.getByLabelText(t.cabinet.email), { target: { value: 'anna@company.ru' } })
    fireEvent.change(screen.getByLabelText(t.cabinet.password), { target: { value: 'secret-password' } })
    expect(fireEvent.submit(form)).toBe(true)
    expect(screen.getByRole('button', { name: t.cabinet.submitting })).toBeDisabled()
  })

  it('shows the Keycloak error at the password and clears it on typing', () => {
    renderLogin(mockFromSearch('?error=1') as LoginContext)
    expect(screen.getByText('Неверное имя пользователя или пароль.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(t.cabinet.password), { target: { value: 'x' } })
    expect(screen.queryByText('Неверное имя пользователя или пароль.')).not.toBeInTheDocument()
  })

  it('hides demo credentials unless the stand is in demo mode (D-16)', () => {
    renderLogin()
    expect(screen.queryByRole('list', { name: t.cabinet.demoAccessLabel })).not.toBeInTheDocument()
  })

  it('fills the form from a demo account', () => {
    renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { properties: DEMO_PROPERTIES } }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(DEMO_PROPERTIES.RAV5_DEMO_ADMIN_EMAIL) }))
    expect(screen.getByLabelText(t.cabinet.email)).toHaveValue(DEMO_PROPERTIES.RAV5_DEMO_ADMIN_EMAIL)
    expect(screen.getByLabelText(t.cabinet.password)).toHaveValue(DEMO_PROPERTIES.RAV5_DEMO_ADMIN_PASSWORD)
  })

  it('sends rememberMe only when the box is checked', () => {
    const form = renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { rememberMe: true } } }))
    expect(form.elements.namedItem('rememberMe')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: t.cabinet.rememberMe }))
    expect(form.elements.namedItem('rememberMe')).toHaveValue('on')
  })

  it('skips the email field when Keycloak already knows the user', () => {
    const form = renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { usernameHidden: true, login: { username: 'anna@company.ru' } } }))
    expect(form.elements.namedItem('username')).toBeNull()
    fireEvent.change(screen.getByLabelText(t.cabinet.password), { target: { value: 'secret-password' } })
    expect(fireEvent.submit(form)).toBe(true)
  })

  it('links to registration when the realm allows it', () => {
    renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { registrationAllowed: true, password: true }, url: { registrationUrl: '/register' } } }))
    expect(screen.getByRole('link', { name: t.cabinet.register })).toHaveAttribute('href', '/register')
  })

  it('opens the app as a guest from the demo card (D-14)', () => {
    renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { properties: { RAV5_APP_URL: 'http://localhost:5173/' } } }))
    expect(screen.getByRole('link', { name: t.demo.open })).toHaveAttribute('href', 'http://localhost:5173/')
  })

  it('accepts a plain username when the email is not the login', () => {
    const form = renderLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { registrationEmailAsUsername: false } } }))
    const login = screen.getByLabelText(t.cabinet.emailOrUsername)
    expect(login).toHaveAttribute('type', 'text')
    fireEvent.submit(form)
    expect(screen.getByText(t.errors.loginRequired)).toBeInTheDocument()
    fireEvent.change(login, { target: { value: 'kcadmin' } })
    fireEvent.change(screen.getByLabelText(t.cabinet.password), { target: { value: 'secret-password' } })
    expect(fireEvent.submit(form)).toBe(true)
  })
})
