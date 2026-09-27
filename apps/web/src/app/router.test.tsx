import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

describe('router', () => {
  it('renders the dashboard screen on /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Дашборд' })).toBeInTheDocument()
    expect(screen.queryByTestId('current-role')).not.toBeInTheDocument()
  })

  it('renders the processes screen on /processes', () => {
    renderAt('/processes')
    expect(screen.getByRole('heading', { level: 1, name: 'Процессы' })).toBeInTheDocument()
  })

  it('renders the locations screen on /locations', () => {
    renderAt('/locations')
    expect(screen.getByRole('heading', { level: 1, name: 'Локации' })).toBeInTheDocument()
  })

  it('renders the new location form on /locations/new', async () => {
    renderAt('/locations/new')
    expect(await screen.findByRole('heading', { level: 1, name: 'Новая локация' })).toBeInTheDocument()
  })

  it('renders a stub with the Figma link on routes without a screen yet', () => {
    renderAt('/admin/norms?as=admin')
    expect(screen.getByRole('link', { name: /15997:371/ })).toHaveAttribute(
      'href',
      'https://www.figma.com/design/sd1kJRdpW6RBFzSi1ztXYK/?node-id=15997-371',
    )
  })

  it('renders the documents tab on /locations/:locationId/documents', async () => {
    renderAt('/locations/LOC-01/documents')
    expect(await screen.findByRole('heading', { name: 'Документы · 4' })).toBeInTheDocument()
  })

  it('renders the object parameters tab on /locations/:locationId/params', async () => {
    renderAt('/locations/LOC-01/params')
    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Параметры объекта' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the location processes tab on /locations/:locationId/processes', async () => {
    renderAt('/locations/LOC-01/processes')
    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Процессы локации' })).toHaveAttribute('aria-current', 'page')
  })

  it('prefers the static /admin/catalog/new over /admin/catalog/:robotId', () => {
    renderAt('/admin/catalog/new')
    expect(screen.getByRole('heading', { level: 1, name: 'Администрирование · новый робот' })).toBeInTheDocument()
  })

  it('shows the screen index on /dev/screens', () => {
    renderAt('/dev/screens')
    expect(screen.getByRole('heading', { level: 1, name: 'Экраны RAV5' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вход · авторизация' })).toHaveAttribute('href', '/login')
  })

  it('shows the token showcase on /dev/tokens', () => {
    renderAt('/dev/tokens')
    expect(screen.getByRole('heading', { level: 1, name: 'Токены RAV5' })).toBeInTheDocument()
    for (const group of ['Цвета', 'Типографика', 'Радиусы', 'Отступы', 'Тени']) {
      expect(screen.getByRole('heading', { level: 2, name: group })).toBeInTheDocument()
    }
    expect(screen.getByText('--rav-color-surface-sunken')).toBeInTheDocument()
    expect(screen.getByText('--rav-shadow-accent-inset')).toBeInTheDocument()
    expect(screen.getByText('type-caption-xs', { exact: false })).toBeInTheDocument()
  })

  it('switches the role with ?as= and remembers it for the session', async () => {
    const view = renderAt('/catalog?as=admin')
    expect(screen.getByTestId('current-role')).toHaveTextContent('Администратор')
    await waitFor(() => { expect(sessionStorage.getItem('rav5.role')).toBe('admin') })
    view.unmount()
    renderAt('/catalog')
    expect(screen.getByTestId('current-role')).toHaveTextContent('Администратор')
  })

  it('defaults to the user role in dev without ?as=', () => {
    renderAt('/catalog')
    expect(screen.getByTestId('current-role')).toHaveTextContent('Пользователь')
  })

  it('marks sections closed for the role (PRD 5.3)', () => {
    renderAt('/admin/norms?as=guest')
    expect(screen.getByTestId('route-access')).toHaveTextContent('Раздел недоступен для роли «Гость»')
  })

  it('shows not found for unknown paths', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeInTheDocument()
  })
})
