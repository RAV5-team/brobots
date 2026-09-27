import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { AdminCatalogImportPage } from './AdminCatalogImportPage'
import { POLL_INTERVAL_MS } from './useCatalogRefresh'

function LocationProbe() {
  const { pathname } = useLocation()
  return <span data-testid="pathname">{pathname}</span>
}

const renderPage = (search = '?as=admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/catalog/import${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <AdminCatalogImportPage />
          <LocationProbe />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ')
const flush = () => act(async () => { await Promise.resolve() })
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS) })

describe('AdminCatalogImportPage (экран А1а)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('locks search, refresh and add while the sources are polled (PRD 6.2)', async () => {
    renderPage()
    await flush()
    expect(screen.getByRole('searchbox', { name: 'Найти решение или производителя' })).toBeDisabled()
    const refreshing = screen.getByRole('button', { name: 'Обновляем каталог…' })
    expect(refreshing).toBeDisabled()
    expect(refreshing).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Добавить робота' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Добавить робота' })).not.toBeInTheDocument()
  })

  it('empties the table: header, placeholder rows and the loading note', async () => {
    renderPage()
    await flush()
    const table = screen.getByRole('table', { name: 'Каталог решений' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Решение', 'Классы операций', 'Грузоподъёмность', 'Цена', 'Обновлено', 'Полнота ТТХ', 'Действия',
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 7)
    expect(within(table).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Загружаем каталог — таблица обновится, когда источники ответят')).toBeInTheDocument()
  })

  it('shows the per-source status and advances to the mockup state «2 из 3»', async () => {
    renderPage()
    await flush()
    expect(screen.getByText('Опрашиваем источники · 1 из 3')).toBeInTheDocument()
    await tick()
    expect(screen.getByText('Опрашиваем источники · 2 из 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Опрос источников' })).toHaveAttribute('aria-valuenow', '67')
    expect(plain(screen.getByText(/^ФЦ БАС/).textContent)).toBe(
      'ФЦ БАС · catalog_export_v5.csv — получено 12 позиций · Ронави Роботикс — ждём ответа · Реестр Минпромторга — в очереди',
    )
  })

  it('returns to the catalog А1 once every source has answered', async () => {
    renderPage()
    await flush()
    await tick()
    await tick()
    await tick()
    expect(screen.getByText(/Реестр Минпромторга — не ответил/)).toBeInTheDocument()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/admin/catalog/import')
    await tick()
    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/admin\/catalog$/)
  })

  it('offers a retry when the poll cannot start and unlocks the toolbar', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const start = vi.spyOn(services.admin, 'startCatalogRefresh').mockRejectedValueOnce(new Error('network'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=admin', services)
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось опросить источники')
    expect(screen.getByRole('link', { name: 'Добавить робота' })).toHaveAttribute('href', '/admin/catalog/new')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await flush()
    expect(start).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Опрашиваем источники · 1 из 3')).toBeInTheDocument()
    log.mockRestore()
  })

  it('is closed for a user (PRD 5.3)', async () => {
    renderPage('?as=user')
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Раздел недоступен для роли «Пользователь»')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
