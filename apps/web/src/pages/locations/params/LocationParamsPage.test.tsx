import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LocationParamsPage } from './LocationParamsPage'

const renderPage = (path = '/locations/LOC-01/params', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/locations/:locationId/params" element={<LocationParamsPage />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const nameInput = () => screen.getByRole('textbox', { name: /Название/ })
const saveButton = () => screen.getByRole('button', { name: 'Сохранить' })

describe('LocationParamsPage (экран 17а)', () => {
  it('shows the header with the update date and the active tab (PRD 10.3)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })).toBeInTheDocument()
    expect(screen.getByText('Обновлено 14.09.2026')).toBeInTheDocument()
    const tabs = within(screen.getByRole('navigation', { name: 'Разделы локации' }))
    expect(tabs.getByRole('link', { name: 'Параметры объекта' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the four form sections read-only with the saved values', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })
    for (const title of ['1. Основное', '2. Площадь и этажность', '3. Режим работы', '4. Персонал']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(nameInput()).toHaveValue('РЦ Химки')
    expect(nameInput()).toBeDisabled()
    expect(saveButton()).toBeDisabled()
    // Подсказка секции 2 не отсылает к самой вкладке (PRD 15 · №46).
    expect(screen.getByText(/приложите план и обследование во вкладке «Документы»/)).toBeInTheDocument()
  })

  it('computes the readiness panel from the profile: 9 / 9, one assumption', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })
    expect(screen.getByText('9 / 9')).toBeInTheDocument()
  })

  it('edits and saves the profile, then returns to view mode with the new values', async () => {
    const services = createMockServices({ latencyMs: 0 })
    renderPage(undefined, services)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить параметры объекта' }))

    expect(nameInput()).toBeEnabled()
    await waitFor(() => { expect(nameInput()).toHaveFocus() })
    fireEvent.change(nameInput(), { target: { value: 'РЦ Химки-Север' } })
    fireEvent.click(saveButton())

    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки-Север' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Изменения сохранены · \d\d:\d\d/)
    expect(nameInput()).toBeDisabled()
    await expect(services.locations.getLocation('LOC-01')).resolves.toMatchObject({ name: 'РЦ Химки-Север' })
  })

  it('blocks saving with errors and moves focus to the first field', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить параметры объекта' }))
    fireEvent.change(nameInput(), { target: { value: '' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText('Проверьте поля с ошибками: 1')).toBeInTheDocument()
    expect(nameInput()).toHaveFocus()
  })

  it('discards changes on «Отменить изменения»', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить параметры объекта' }))
    fireEvent.change(nameInput(), { target: { value: 'Черновик' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения' }))

    expect(nameInput()).toHaveValue('РЦ Химки')
    expect(nameInput()).toBeDisabled()
  })

  it('keeps the form editable and shows an error when saving fails', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.locations, 'updateLocation').mockRejectedValue(new Error('сеть'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage(undefined, services)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить параметры объекта' }))
    fireEvent.click(saveButton())

    expect(await screen.findByText(/Не удалось сохранить изменения/)).toBeInTheDocument()
    expect(nameInput()).toBeEnabled()
  })

  it('locks the facility type of a saved location', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить параметры объекта' }))
    expect(screen.getByRole('radio', { name: 'Аэропорт' })).toBeDisabled()
    expect(screen.getByText(/Тип объекта не меняется после создания/)).toBeInTheDocument()
  })

  it('shows only the basics for a non-warehouse location', async () => {
    renderPage('/locations/LOC-03/params')
    expect(await screen.findByRole('heading', { level: 1, name: 'Терминал Внуково-2' })).toBeInTheDocument()
    expect(screen.getByText('Разделы для типа «Аэропорт» ещё не готовы')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '2. Площадь и этажность' })).not.toBeInTheDocument()
  })

  it('lets a guest only view: demo banner, no «Изменить» (D-14)', async () => {
    renderPage('/locations/LOC-01/params?as=guest')
    await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })
    expect(screen.queryByRole('button', { name: 'Изменить параметры объекта' })).not.toBeInTheDocument()
    expect(nameInput()).toBeDisabled()
  })

  it('shows «не найдена» for an unknown location', async () => {
    renderPage('/locations/LOC-99/params')
    expect(await screen.findByText('Локация не найдена')).toBeInTheDocument()
  })
})
