import { fireEvent, render, screen } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createMockServices } from '@/services/mock'
import { createMockSession } from '@/services/mock/session'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import type { DemoAccount } from '@/shared/auth/demoAccounts'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { LoginPage } from './LoginPage'

const ACCOUNTS: readonly DemoAccount[] = [
  { role: 'user', email: 'user@example.test', password: 'user-secret' },
  { role: 'admin', email: 'admin@example.test', password: 'admin-secret' },
]

function RoleProbe() {
  return <p data-testid="role">{useRole()}</p>
}

function renderLogin(demoAccounts: readonly DemoAccount[], keycloakLogin: (() => Promise<void>) | null = null) {
  const options = { latencyMs: 0 }
  const services = { ...createMockServices(options), session: createMockSession(options, demoAccounts) }
  const router = createMemoryRouter(
    [
      {
        element: (
          <ServicesProvider services={services}>
            <RoleProvider>
              <Outlet />
            </RoleProvider>
          </ServicesProvider>
        ),
        children: [
          { path: '/login', element: <LoginPage demoAccounts={demoAccounts} keycloakLogin={keycloakLogin} /> },
          { path: '/', element: <RoleProbe /> },
        ],
      },
    ],
    { initialEntries: ['/login'] },
  )
  render(<RouterProvider router={router} />)
}

const t = ru.login

describe('LoginPage (экран 05)', () => {
  it('hides demo credentials outside the demo build (D-16)', () => {
    renderLogin([])
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: t.cabinet.demoAccessLabel })).not.toBeInTheDocument()
  })

  it('opens the demo as a guest (D-14)', async () => {
    renderLogin([])
    fireEvent.click(screen.getByRole('button', { name: t.demo.open }))
    expect(await screen.findByTestId('role')).toHaveTextContent('guest')
  })

  it('asks to fill the form before signing in', () => {
    renderLogin([])
    fireEvent.click(screen.getByRole('button', { name: t.cabinet.submit }))
    expect(screen.getByText(t.errors.emailRequired)).toBeInTheDocument()
    expect(screen.getByText(t.errors.passwordRequired)).toBeInTheDocument()
  })

  it('fills the form from a demo plate and signs in as admin', async () => {
    renderLogin(ACCOUNTS)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.cabinet.demoAccess.admin) }))
    expect(screen.getByLabelText(t.cabinet.email)).toHaveValue('admin@example.test')
    expect(screen.getByLabelText(t.cabinet.password)).toHaveValue('admin-secret')
    fireEvent.click(screen.getByRole('button', { name: t.cabinet.submit }))
    expect(await screen.findByTestId('role')).toHaveTextContent('admin')
  })

  it('explains how to fix a wrong password', async () => {
    renderLogin(ACCOUNTS)
    fireEvent.change(screen.getByLabelText(t.cabinet.email), { target: { value: 'user@example.test' } })
    fireEvent.change(screen.getByLabelText(t.cabinet.password), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: t.cabinet.submit }))
    expect(await screen.findByText(t.errors.invalidCredentials)).toBeInTheDocument()
  })

  it('with Keycloak goes straight to its login page themed as screen 05', () => {
    const keycloakLogin = vi.fn(() => new Promise<void>(() => undefined))
    renderLogin([], keycloakLogin)
    expect(keycloakLogin).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent(t.redirecting)
    expect(screen.queryByRole('button', { name: t.cabinet.submit })).not.toBeInTheDocument()
  })

  it('falls back to the demo screen when Keycloak is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderLogin([], () => Promise.reject(new Error('Вход через Keycloak недоступен')))
    expect(await screen.findByRole('button', { name: t.demo.open })).toBeInTheDocument()
  })
})
