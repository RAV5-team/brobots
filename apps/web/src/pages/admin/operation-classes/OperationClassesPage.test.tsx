import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { OperationClassesPage } from './OperationClassesPage'

const renderPage = (search = '?as=admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/operation-classes${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <OperationClassesPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const bodyRows = async () => {
  const table = await screen.findByRole('table', { name: 'Классы операций' })
  return within(table).getAllByRole('row').slice(1)
}

describe('OperationClassesPage (экран А8)', () => {
  it('shows the admin header with «Классы операций» as the current tab', async () => {
    renderPage()
    await bodyRows()
    expect(screen.getByRole('heading', { level: 1, name: 'Администрирование' })).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Разделы администрирования' })
    expect(within(tabs).getByRole('link', { name: 'Классы операций' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Журнал' })).toHaveAttribute('href', '/admin/journal')
  })

  it('lists ten classes with code, name, robots and processes (PRD 6.7)', async () => {
    renderPage()
    const rows = await bodyRows()
    expect(rows).toHaveLength(10)
    const first = within(rows[0] as HTMLElement)
    expect(first.getByText('OP-01')).toBeInTheDocument()
    expect(first.getByText('Перемещение грузов')).toBeInTheDocument()
    expect(first.getByText(/^\d+\s(робот|робота|роботов)$/)).toBeInTheDocument()
    expect(first.getByText('2 процесса')).toBeInTheDocument()
  })

  it('declines counts by Russian plural rules (PRD 15 · №50) and says «нет процессов» for unused classes', async () => {
    renderPage()
    const rows = await bodyRows()
    expect(within(rows[7] as HTMLElement).getByText('4 процесса')).toBeInTheDocument()
    expect(within(rows[3] as HTMLElement).getByText('нет процессов')).toBeInTheDocument()
    expect(screen.queryByText(/\b[234] роботов\b/)).not.toBeInTheDocument()
  })

  it('shows the counted footnote under the table', async () => {
    renderPage()
    expect(await screen.findByText(/^10 классов\. У процесса один класс/)).toBeInTheDocument()
  })

  it('opens the «Новый класс операции» dialog with the next code (А10, PRD 6.7)', async () => {
    renderPage()
    await bodyRows()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    const dialog = screen.getByRole('dialog', { name: 'Новый класс операции' })
    expect(dialog).toHaveAccessibleDescription(/ключ подбора/)
    expect(within(dialog).getByLabelText(/^Код класса/)).toHaveValue('OP-11 · присваивается автоматически')
    expect(within(dialog).getByLabelText(/^Код класса/)).toHaveAttribute('readonly')
    expect(within(dialog).queryByText(/PDF, Excel, CSV/)).not.toBeInTheDocument()
  })

  it('explains empty required fields and a duplicate name instead of creating', async () => {
    renderPage()
    await bodyRows()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать класс' }))
    expect(within(dialog).getByLabelText(/^Название/)).toHaveAccessibleDescription(/Введите название класса/)
    expect(within(dialog).getByLabelText(/^Единица измерения/)).toBeInvalid()
    expect(within(dialog).getByLabelText(/^Название/)).toHaveFocus()

    fireEvent.change(within(dialog).getByLabelText(/^Название/), { target: { value: 'Сортировка' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать класс' }))
    expect(within(dialog).getByLabelText(/^Название/)).toHaveAccessibleDescription(/уже есть у класса OP-03/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('creates the class, closes the dialog and shows it in the list with zero robots', async () => {
    renderPage()
    await bodyRows()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^Название/), { target: { value: 'Буксировка прицепов' } })
    fireEvent.change(within(dialog).getByLabelText(/^Что делает процесс/), { target: { value: 'Перемещение прицепов и тележек между зонами тягачом' } })
    fireEvent.change(within(dialog).getByLabelText(/^Единица измерения/), { target: { value: 'ед. / ч' } })
    fireEvent.change(within(dialog).getByLabelText(/^Типовые носители/), { target: { value: 'прицеп, тележка' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать класс' }))

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(await screen.findByRole('status')).toHaveTextContent('Класс OP-11 «Буксировка прицепов» добавлен')
    await waitFor(() => { expect(screen.getAllByRole('row')).toHaveLength(12) })
    const last = within(screen.getAllByRole('row').at(-1) as HTMLElement)
    expect(last.getByText('OP-11')).toBeInTheDocument()
    expect(last.getByText('0 роботов')).toBeInTheDocument()
    expect(last.getByText('нет процессов')).toBeInTheDocument()
    expect(screen.getByText(/^11 классов\./)).toBeInTheDocument()
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Добавить класс' })).toHaveFocus() })
  })

  it('keeps the entered values and shows an error when creation fails', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: Services = { ...services, catalog: { ...services.catalog, createOperationClass: () => Promise.reject(new Error('down')) } }
    renderPage('?as=admin', failing)
    await bodyRows()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^Название/), { target: { value: 'Буксировка прицепов' } })
    fireEvent.change(within(dialog).getByLabelText(/^Что делает процесс/), { target: { value: 'Тягачом' } })
    fireEvent.change(within(dialog).getByLabelText(/^Единица измерения/), { target: { value: 'ед. / ч' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать класс' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось создать класс')
    expect(within(dialog).getByLabelText(/^Название/)).toHaveValue('Буксировка прицепов')
    spy.mockRestore()
  })

  it('resets the form after «Отмена»', async () => {
    renderPage()
    await bodyRows()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/^Название/), { target: { value: 'Черновик' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить класс' }))
    expect(within(screen.getByRole('dialog')).getByLabelText(/^Название/)).toHaveValue('')
  })

  it('denies the section to a user (PRD 5.3)', () => {
    renderPage('?as=user')
    expect(screen.getByRole('alert')).toHaveTextContent('Раздел недоступен для роли «Пользователь»')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error with retry when the directory fails to load', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: Services = { ...services, catalog: { ...services.catalog, listOperationClasses: () => Promise.reject(new Error('down')) } }
    renderPage('?as=admin', failing)
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument()
    spy.mockRestore()
  })
})
