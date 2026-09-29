import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ru } from '@/shared/i18n/ru'
import KcPage from '../KcPage'
import { getKcContextMock } from '../mocks'

const t = ru.login

describe('KcPage', () => {
  it('renders registration with the fields auth_smoke.py posts', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'register.ftl', overrides: { url: { registrationAction: '/register-action', loginUrl: '/login' } } })} />)
    const form = document.getElementById('kc-register-form')
    if (!(form instanceof HTMLFormElement)) throw new Error('нет формы kc-register-form')
    expect(form).toHaveAttribute('action', '/register-action')
    for (const name of ['email', 'firstName', 'lastName', 'password', 'password-confirm']) {
      expect(form.elements.namedItem(name), name).toBeInstanceOf(HTMLInputElement)
    }
    // Почта — логин (registrationEmailAsUsername): отдельного поля нет.
    expect(form.elements.namedItem('username')).toBeNull()
    expect(screen.getByRole('link', { name: t.register.toLogin })).toHaveAttribute('href', '/login')
  })

  it('shows field errors from Keycloak on registration', () => {
    render(
      <KcPage
        kcContext={getKcContextMock({
          pageId: 'register.ftl',
          overrides: { messagesPerField: { existsError: (name: string) => name === 'email', get: () => 'Почта уже занята' } },
        })}
      />,
    )
    expect(screen.getByText('Почта уже занята')).toBeInTheDocument()
  })

  it('confirms logout with the session code', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'logout-confirm.ftl', overrides: { logoutConfirm: { code: 'abc', skipLink: false }, url: { logoutConfirmAction: '/logout' }, properties: { RAV5_APP_URL: 'http://localhost/' } } })} />)
    const form = screen.getByRole('button', { name: t.logoutConfirm.submit }).closest('form')
    expect(form).toHaveAttribute('action', '/logout')
    expect(form?.elements.namedItem('session_code')).toHaveValue('abc')
    expect(screen.getByRole('link', { name: t.backToApp })).toHaveAttribute('href', 'http://localhost/')
  })

  it('restarts an expired login', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'login-page-expired.ftl', overrides: { url: { loginRestartFlowUrl: '/restart', loginAction: '/continue' } } })} />)
    expect(screen.getByRole('link', { name: t.pageExpired.restart })).toHaveAttribute('href', '/restart')
    expect(screen.getByRole('link', { name: t.pageExpired.proceed })).toHaveAttribute('href', '/continue')
  })

  it('asks for a new password and lets an app-initiated change be cancelled', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'login-update-password.ftl', overrides: { isAppInitiatedAction: true } })} />)
    const form = screen.getByRole('button', { name: t.updatePassword.submit }).closest('form')
    expect(form?.elements.namedItem('password-new')).toBeInstanceOf(HTMLInputElement)
    expect(form?.elements.namedItem('password-confirm')).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByRole('button', { name: t.updatePassword.cancel })).toHaveAttribute('name', 'cancel-aia')
  })

  it('continues from an info page', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'info.ftl', overrides: { skipLink: false, actionUri: '/next', message: { type: 'info', summary: 'Почта подтверждена' } } })} />)
    expect(screen.getByText('Почта подтверждена')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.info.proceed })).toHaveAttribute('href', '/next')
  })

  it('returns to the app from an info page without a next step', () => {
    // В моке info.ftl есть ссылка дальше — убираем её, чтобы остался только возврат в приложение.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- поля выкидываются из контекста
    const { actionUri, pageRedirectUri, ...context } = getKcContextMock({ pageId: 'info.ftl', overrides: { skipLink: false, properties: { RAV5_APP_URL: 'http://localhost/' } } })
    render(<KcPage kcContext={context} />)
    expect(screen.getByRole('link', { name: t.backToApp })).toHaveAttribute('href', 'http://localhost/')
  })

  it('shows a Keycloak error as a banner', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'error.ftl', overrides: { message: { type: 'error', summary: 'Ссылка устарела' }, skipLink: false } })} />)
    expect(screen.getByRole('heading', { level: 1, name: t.error.title })).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Ссылка устарела' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.backToApp })).toBeInTheDocument()
  })

  it('renders the login screen', () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'login.ftl' })} />)
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
  })

  it('falls back to the default keycloakify page for pages RAV5 does not style', async () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'login-otp.ftl' })} />)
    // Стандартный шаблон ставит свои классы Keycloak на body; содержимое ждёт CSS Keycloak, в jsdom он не грузится.
    await waitFor(() => { expect(document.body).toHaveClass('kcBodyClass') })
    expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument()
  })

  it('hands login with identity providers to the default page instead of dropping them', async () => {
    const providers = [{ alias: 'google', providerId: 'google', displayName: 'Google', loginUrl: '/broker/google' }]
    render(<KcPage kcContext={getKcContextMock({ pageId: 'login.ftl', overrides: { social: { displayInfo: true, providers } } })} />)
    await waitFor(() => { expect(document.body).toHaveClass('kcBodyClass') })
    expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument()
  })

  it('hands registration with terms acceptance to the default page', async () => {
    render(<KcPage kcContext={getKcContextMock({ pageId: 'register.ftl', overrides: { termsAcceptanceRequired: true } })} />)
    await waitFor(() => { expect(document.body).toHaveClass('kcBodyClass') })
    expect(screen.queryByText(t.register.lead)).not.toBeInTheDocument()
  })
})
