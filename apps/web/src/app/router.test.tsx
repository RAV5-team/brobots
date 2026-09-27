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

  it('renders a stub with the Figma link on routes without a screen yet', () => {
    renderAt('/locations')
    expect(screen.getByRole('link', { name: /15950:1627/ })).toHaveAttribute(
      'href',
      'https://www.figma.com/design/sd1kJRdpW6RBFzSi1ztXYK/?node-id=15950-1627',
    )
  })

  it('lists states and modals living on the same route', () => {
    renderAt('/locations/demo/processes')
    expect(screen.getByRole('heading', { level: 1, name: 'Локации · процессы локации' })).toBeInTheDocument()
    expect(screen.getByText('Локации · выбрать процесс')).toBeInTheDocument()
    expect(screen.getByText('Локации · удалить процесс с локации')).toBeInTheDocument()
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
