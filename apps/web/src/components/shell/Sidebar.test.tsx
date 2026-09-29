import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Role } from '@/domain'
import { DATA_VERSION, PROFILES } from '@/mocks/fixtures/session'
import { Sidebar } from './Sidebar'
import type { NavKey } from './navigation'

const renderSidebar = (role: Role, activeKey: NavKey | null = 'processes') =>
  render(
    <MemoryRouter>
      <Sidebar
        role={role}
        activeKey={activeKey}
        counts={{ projects: 5, processes: 12, locations: 4, catalog: 20 }}
        profile={PROFILES[role]}
        dataVersion={DATA_VERSION}
      />
    </MemoryRouter>,
  )

const nav = () => within(screen.getByRole('navigation', { name: 'Основная навигация' }))

describe('Sidebar', () => {
  it('marks the active section with aria-current and shows its counter', () => {
    renderSidebar('user')
    const active = nav().getByRole('link', { current: 'page' })
    expect(active).toHaveTextContent('Процессы12')
    expect(active).toHaveAttribute('href', '/processes')
  })

  it('shows «Интеграции» greyed out without a link: the section is not ready', () => {
    renderSidebar('user')
    expect(nav().queryByRole('link', { name: /Интеграции/ })).not.toBeInTheDocument()
    const item = nav().getByText('Интеграции').closest('[aria-disabled="true"]')
    expect(item).toHaveTextContent('Интеграциискоро')
    expect(item).toHaveAttribute('title', 'Раздел в разработке')
  })

  it('shows administration only to the admin', () => {
    renderSidebar('admin', 'admin')
    expect(nav().getByRole('link', { name: 'Администрирование' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the guest menu and new demo project button', () => {
    renderSidebar('guest')
    // Ролевая модель, §3: дашборд, демо-проекты, процессы, локации и каталог — без интеграций и администрирования.
    expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['Дашборд', 'Демо-проекты5', 'Процессы12', 'Локации4', 'Каталог20'])
    expect(screen.getByRole('link', { name: /Открыть демо-проект/ })).toBeInTheDocument()
  })

  it('opens the cabinet menu, closes it with Escape and returns focus', () => {
    renderSidebar('user')
    const button = screen.getByRole('button', { name: 'Меню кабинета: И. Демидов' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ФЦ БАС · каталог v4 · модель 2.1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Выйти' })).toHaveAttribute('href', '/login')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('closes the menu on an outside click', () => {
    renderSidebar('admin')
    const button = screen.getByRole('button', { name: /Меню кабинета/ })
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives the guest help and sign-in instead of the cabinet', () => {
    renderSidebar('guest')
    fireEvent.click(screen.getByRole('button', { name: 'Меню кабинета: Гость' }))
    expect(screen.getByRole('link', { name: 'Войти в рабочий кабинет' })).toBeInTheDocument()
    expect(screen.queryByText('Профиль и уведомления')).not.toBeInTheDocument()
  })
})
