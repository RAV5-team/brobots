import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { AdminCatalogPage } from './AdminCatalogPage'

function LocationProbe() {
  const { search } = useLocation()
  return <span data-testid="search">{search}</span>
}

const renderPage = (search = '?as=admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/catalog${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <AdminCatalogPage />
          <LocationProbe />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const bodyRows = async () => {
  const table = await screen.findByRole('table', { name: 'Каталог решений' })
  return within(table).getAllByRole('row').slice(1)
}

const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ')

describe('AdminCatalogPage (экран А1)', () => {
  it('shows the admin header with «Каталог» as the current tab', async () => {
    renderPage()
    await bodyRows()
    const tabs = screen.getByRole('navigation', { name: 'Разделы администрирования' })
    expect(within(tabs).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists every robot with six data columns and a link to its card (PRD 6.2)', async () => {
    renderPage()
    const rows = await bodyRows()
    expect(rows).toHaveLength(20)
    const first = within(rows[0] as HTMLElement)
    expect(first.getByText('DMR 600')).toBeInTheDocument()
    expect(first.getByText('требует подтверждения')).toBeInTheDocument()
    expect(first.getByText('OP-01')).toBeInTheDocument()
    expect(plain(first.getByText(/^до .* кг$/).textContent)).toBe('до 600 кг')
    expect(plain(first.getByText(/млн/).textContent)).toBe('3,75 млн ₽')
    expect(first.getByText('12.08.2026')).toBeInTheDocument()
    expect(first.getByRole('link', { name: 'Открыть карточку DMR 600' })).toHaveAttribute('href', '/admin/catalog/RB-0011')
    expect(plain(screen.getByRole('status').textContent)).toBe('Показаны 20 из 20 решений')
  })

  it('links «Обновить каталог по запросу» to А1а and «Добавить робота» to А2', async () => {
    renderPage()
    await bodyRows()
    expect(screen.getByRole('link', { name: 'Обновить каталог по запросу' })).toHaveAttribute('href', '/admin/catalog/import')
    expect(screen.getByRole('link', { name: 'Добавить робота' })).toHaveAttribute('href', '/admin/catalog/new')
  })

  it('searches by name or manufacturer and keeps the query in the address', async () => {
    renderPage()
    await bodyRows()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти решение или производителя' }), { target: { value: 'морос' } })
    expect(await bodyRows()).toHaveLength(3)
    expect(plain(screen.getByRole('status').textContent)).toBe('Показаны 3 из 20 решений')
    expect(screen.getByTestId('search')).toHaveTextContent('?as=admin&q=%D0%BC%D0%BE%D1%80%D0%BE%D1%81')
  })

  it('says nothing was found for an unknown query', async () => {
    renderPage('?as=admin&q=xyz')
    expect(await screen.findByText('Ничего не нашлось')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(plain(screen.getByRole('status').textContent)).toBe('Показаны 0 из 20 решений')
  })

  it('shows an error with retry when the catalog does not load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    let calls = 0
    const flaky: Services = {
      ...services,
      catalog: { ...services.catalog, listRobots: () => (calls++ === 0 ? Promise.reject(new Error('down')) : services.catalog.listRobots()) },
    }
    renderPage('?as=admin', flaky)
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    expect(await bodyRows()).toHaveLength(20)
  })

  it('shows «Каталог обновлён» with a link to the catalog after a robot is saved (экран А3, PRD 6.2)', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-09-19T12:00:20+03:00'), toFake: ['Date'] })
    try {
      renderPage('?as=admin&added=RB-0008')
      const rows = await bodyRows()
      const banner = screen.getByRole('status', { name: 'Каталог обновлён' })
      expect(within(banner).getByRole('link', { name: 'Открыть в каталоге' })).toHaveAttribute('href', '/catalog?q=AMR+800')
      const saved = within(rows[2] as HTMLElement)
      expect(saved.getByText('AMR 800')).toBeInTheDocument()
      expect(saved.getByText('сейчас')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows no banner when the saved robot is not in the catalog', async () => {
    renderPage('?as=admin&added=RB-9999')
    await bodyRows()
    expect(screen.queryByRole('status', { name: 'Каталог обновлён' })).not.toBeInTheDocument()
  })

  it('is closed for a user (PRD 5.3)', () => {
    renderPage('?as=user')
    expect(screen.getByText('Раздел недоступен для роли «Пользователь»')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
