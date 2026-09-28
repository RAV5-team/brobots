import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { NormsPage } from './NormsPage'

const renderPage = (search = '?as=admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/norms${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <NormsPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const bodyRows = async () => {
  const table = await screen.findByRole('table', { name: 'Нормативы и допущения по умолчанию' })
  return within(table).getAllByRole('row').slice(1)
}

const valueField = (name: RegExp) => screen.getByRole('textbox', { name })

describe('NormsPage (экран А5)', () => {
  it('shows the admin header with «Нормативы и допущения» as the current tab', async () => {
    renderPage()
    await bodyRows()
    const tabs = screen.getByRole('navigation', { name: 'Разделы администрирования' })
    expect(within(tabs).getByRole('link', { name: 'Нормативы и допущения' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists 35 values in 6 groups with kind, unit and source (PRD 6.8)', async () => {
    renderPage()
    const rows = await bodyRows()
    expect(rows).toHaveLength(35)
    const first = within(rows[0] as HTMLElement)
    expect(first.getByText('Коэффициент начислений на ФОТ (страховые взносы)')).toBeInTheDocument()
    expect(first.getByText('Персонал')).toBeInTheDocument()
    expect(first.getByText('норматив')).toBeInTheDocument()
    expect(first.getByRole('textbox')).toHaveValue('1,302')
    expect(first.getByText('коэф.')).toBeInTheDocument()
    expect(screen.getAllByText('норматив')).toHaveLength(13)
    expect(screen.getAllByText('допущение')).toHaveLength(22)
    expect(within(rows[34] as HTMLElement).getByRole('textbox')).toHaveValue('±10')
  })

  it('shows no save bar until a value changes', async () => {
    renderPage()
    await bodyRows()
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument()
  })

  it('blocks saving while a value is not a number', async () => {
    renderPage()
    await bodyRows()
    const field = valueField(/^Коэффициент загрузки робота/)
    fireEvent.change(field, { target: { value: 'восемьдесят' } })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Только число, например 7,5')
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled()
  })

  it('saves changed values as one version and reports it (PRD 6)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const saveNorms = vi.spyOn(services.admin, 'saveNorms')
    renderPage('?as=admin', services)
    await bodyRows()
    fireEvent.change(valueField(/^Коэффициент загрузки робота/), { target: { value: '85' } })
    fireEvent.change(valueField(/^Тариф на электроэнергию/), { target: { value: '8,2' } })
    expect(screen.getByText(/^Изменено 2 значения\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    expect(await screen.findByText(/^Нормативы сохранены: 2 значения\./)).toBeInTheDocument()
    expect(saveNorms).toHaveBeenCalledWith([
      { code: 'robot_utilization_pct', value: 85 },
      { code: 'electricity_tariff_rub_kwh', value: 8.2 },
    ])
    expect(valueField(/^Тариф на электроэнергию/)).toHaveValue('8,2')
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument()
  })

  it('restores saved values on «Отменить изменения»', async () => {
    renderPage()
    await bodyRows()
    const field = valueField(/^Коэффициент загрузки робота/)
    fireEvent.change(field, { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения' }))
    expect(field).toHaveValue('80')
  })

  it('keeps edits and explains when saving fails', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.admin, 'saveNorms').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=admin', services)
    await bodyRows()
    fireEvent.change(valueField(/^Коэффициент загрузки робота/), { target: { value: '85' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Правки остались в полях/)
    expect(valueField(/^Коэффициент загрузки робота/)).toHaveValue('85')
  })

  it('shows an error with retry when the norms do not load', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const list = vi.spyOn(services.admin, 'listNorms').mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=admin', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await bodyRows()).toHaveLength(35)
  })

  it('is closed to a user (PRD 5.3)', () => {
    renderPage('?as=user')
    expect(screen.getByText('Раздел недоступен для роли «Пользователь»')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
