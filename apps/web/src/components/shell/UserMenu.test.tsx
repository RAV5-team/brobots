import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { UserMenu } from './UserMenu'

const logout = vi.hoisted(() => vi.fn(() => Promise.resolve()))

// Меню читает флаг входа через Keycloak при загрузке модуля — здесь он включён.
vi.mock('@/shared/auth/oidc', () => ({ OIDC_ENABLED: true, logout }))

const PROFILE: Profile = { role: 'user', name: 'Анна Петрова', initials: 'АП', email: 'anna@company.ru', organization: null }

describe('UserMenu с Keycloak', () => {
  it('logs out through Keycloak without routing to /login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<UserMenu profile={PROFILE} dataVersion={null} />} />
          <Route path="/login" element={<p>экран входа</p>} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: new RegExp(PROFILE.name) }))
    fireEvent.click(screen.getByRole('button', { name: ru.cabinetMenu.logout }))

    expect(logout).toHaveBeenCalledOnce()
    // Переход на /login перебил бы выход: экран входа сразу уводит на Keycloak, и сессия осталась бы жива.
    expect(screen.queryByText('экран входа')).not.toBeInTheDocument()
  })
})
