import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { formatDateOf } from '@/shared/format'
import { DataSourcesPage } from './DataSourcesPage'

const renderPage = (search = '?as=admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/sources${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <DataSourcesPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const bodyRows = async () => {
  const table = await screen.findByRole('table', { name: 'Источники данных' })
  return within(table).getAllByRole('row').slice(1)
}

const rowOf = async (name: string) => {
  const rows = await bodyRows()
  const row = rows.find((r) => within(r).queryByText(name))
  if (!row) throw new Error(name)
  return within(row)
}

const sized = (name: string, sizeMb: number) => {
  const file = new File([new Uint8Array(0)], name)
  Object.defineProperty(file, 'size', { value: Math.round(sizeMb * 1024 * 1024) })
  return file
}

const fileInput = (dialog: HTMLElement) => {
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('нет поля файла')
  return input
}

const openDialog = async (services?: Services) => {
  renderPage('?as=admin', services)
  await bodyRows()
  fireEvent.click(screen.getByRole('button', { name: /Добавить источник/ }))
  return screen.getByRole('dialog', { name: 'Новый источник данных' })
}

const fillValidForm = async (dialog: HTMLElement) => {
  fireEvent.change(within(dialog).getByLabelText(/^Название/), { target: { value: 'Данные поставщика «Морос», ТТХ AMR 800' } })
  fireEvent.keyDown(within(dialog).getByRole('combobox', { name: /^Тип/ }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('option', { name: 'ТТХ решений' }))
  fireEvent.change(fileInput(dialog), { target: { files: [sized('moros_amr800_spec.pdf', 2.4)] } })
  fireEvent.change(within(dialog).getByLabelText(/^Дата актуализации/), { target: { value: '19.09.2026' } })
}

describe('DataSourcesPage (экран А6)', () => {
  it('shows the admin header with «Источники» as the current tab', async () => {
    renderPage()
    await bodyRows()
    expect(screen.getByRole('heading', { level: 1, name: 'Администрирование' })).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Разделы администрирования' })
    expect(within(tabs).getByRole('link', { name: 'Источники' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists every source with type, status, what it gives, date and refresh mode (PRD 6.9)', async () => {
    renderPage()
    expect(await bodyRows()).toHaveLength(7)
    const catalog = await rowOf('Каталог ФЦ БАС · catalog_export_v4')
    expect(catalog.getByText('таблица организатора')).toBeInTheDocument()
    expect(catalog.getByText('подтверждено')).toBeInTheDocument()
    expect(catalog.getByText('223 строки · 187 решений · цены с НДС')).toBeInTheDocument()
    expect(catalog.getByText('12.08.2026')).toBeInTheDocument()
    expect(catalog.getByText('вручную · файл')).toBeInTheDocument()
    expect((await rowOf('Официальные сайты производителей')).getByText('оценка')).toBeInTheDocument()
  })

  it('counts norms from the А5 reference, not «33 норматива» (PRD 15 · №10)', async () => {
    renderPage()
    expect((await rowOf('Нормативы модели 2.1')).getByText('34 норматива')).toBeInTheDocument()
  })

  it('lets only a linked source switch auto-refresh and saves the choice (PRD 6.10)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.admin, 'updateDataSource')
    renderPage('?as=admin', services)
    expect((await rowOf('Каталог ФЦ БАС · catalog_export_v4')).getByRole('switch')).toBeDisabled()
    const vendor = await rowOf('Официальные сайты производителей')
    const toggle = vendor.getByRole('switch', { name: 'Автообновление: Официальные сайты производителей' })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    await waitFor(() => { expect(vendor.getByText('вручную')).toBeInTheDocument() })
    expect(update).toHaveBeenCalledWith('vendor_sites', { refresh: 'manual' })
    expect(toggle).not.toBeChecked()
  })

  it('refreshes a source on request and announces the new date', async () => {
    renderPage()
    const datasets = await rowOf('Демо-датасеты объектов')
    fireEvent.click(datasets.getByRole('button', { name: 'Обновить: Демо-датасеты объектов' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/^Источник «Демо-датасеты объектов» обновлён · \d{2}\.\d{2}\.\d{4}$/)
    expect(datasets.queryByText('15.09.2026')).not.toBeInTheDocument()
  })

  it('reports a failed refresh without losing the table', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.admin, 'refreshDataSource').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=admin', services)
    const datasets = await rowOf('Демо-датасеты объектов')
    fireEvent.click(datasets.getByRole('button', { name: 'Обновить: Демо-датасеты объектов' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Не удалось обновить «Демо-датасеты объектов»')
    expect(datasets.getByText('15.09.2026')).toBeInTheDocument()
  })

  it('shows an error with retry when sources fail to load', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.admin, 'listDataSources').mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=admin', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    expect(await bodyRows()).toHaveLength(7)
  })

  it('opens the «Новый источник данных» dialog over the registry (А7, PRD 6.10)', async () => {
    const dialog = await openDialog()
    expect(dialog).toHaveAccessibleDescription('Источник попадёт в отчёты и реестр допущений')
    expect(within(dialog).getByRole('radio', { name: 'Файл' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('radio', { name: 'Ссылка' })).toBeEnabled()
    expect(within(dialog).getByRole('radio', { name: 'подтверждено' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('switch', { name: 'Автообновление источника' })).toBeDisabled()
    expect(within(dialog).getByText('вручную · это файл')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Дата актуализации/)).toHaveValue(formatDateOf(new Date().toISOString()))
    expect(within(dialog).getByRole('button', { name: 'Выбрать файл: Файл или ссылка' })).toHaveAccessibleDescription(/PDF, Excel, CSV или изображение до 20 МБ/)
  })

  it('explains empty required fields and a duplicate name instead of adding', async () => {
    const dialog = await openDialog()
    fireEvent.change(within(dialog).getByLabelText(/^Дата актуализации/), { target: { value: '31.02.2026' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))
    expect(within(dialog).getByLabelText(/^Название/)).toHaveAccessibleDescription(/Введите название источника/)
    expect(within(dialog).getByLabelText(/^Название/)).toHaveFocus()
    expect(within(dialog).getByRole('combobox', { name: /^Тип/ })).toHaveAccessibleDescription(/Выберите тип/)
    expect(within(dialog).getByRole('button', { name: 'Выбрать файл: Файл или ссылка' })).toHaveAccessibleDescription(/Выберите файл источника/)
    expect(within(dialog).getByLabelText(/^Дата актуализации/)).toHaveAccessibleDescription(/Такой даты нет/)

    fireEvent.change(within(dialog).getByLabelText(/^Название/), { target: { value: 'демо-датасеты объектов' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))
    expect(within(dialog).getByLabelText(/^Название/)).toHaveAccessibleDescription(/уже есть в реестре/)
  })

  it('rejects a file outside the upload rule with a fix (D-18)', async () => {
    const dialog = await openDialog()
    fireEvent.change(fileInput(dialog), { target: { files: [sized('plan.dwg', 1)] } })
    expect(within(dialog).getByRole('button', { name: 'Выбрать файл: Файл или ссылка' })).toHaveAccessibleDescription(/Формат \.dwg не поддерживается/)
  })

  it('adds a file source, closes the dialog, shows the row and returns focus', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.admin, 'createDataSource')
    const dialog = await openDialog(services)
    await fillValidForm(dialog)
    fireEvent.click(within(dialog).getByRole('radio', { name: 'оценка' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'specs', status: 'estimate', refresh: 'manual', actualizedOn: '2026-09-19',
      locator: { kind: 'file', fileName: 'moros_amr800_spec.pdf' },
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Источник «Данные поставщика «Морос», ТТХ AMR 800» добавлен в реестр')
    const row = await rowOf('Данные поставщика «Морос», ТТХ AMR 800')
    expect(row.getByText('открытый источник')).toBeInTheDocument()
    expect(row.getByText('оценка')).toBeInTheDocument()
    expect(row.getByText('19.09.2026')).toBeInTheDocument()
    expect(row.getByText('вручную · файл')).toBeInTheDocument()
    await waitFor(() => { expect(screen.getByRole('button', { name: /Добавить источник/ })).toHaveFocus() })
  })

  it('keeps the entered values and shows an error when adding fails', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.admin, 'createDataSource').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const dialog = await openDialog(services)
    await fillValidForm(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось добавить источник')
    expect(within(dialog).getByLabelText(/^Название/)).toHaveValue('Данные поставщика «Морос», ТТХ AMR 800')
  })

  it('switches to a link: URL field with «Проверить», no file hint, weekly auto-refresh (А7б, PRD 6.10)', async () => {
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Ссылка' }))
    const url = within(dialog).getByLabelText(/^Ссылка на источник/)
    expect(url).toHaveAccessibleDescription('Официальный сайт производителя, техпаспорт или публичный каталог')
    expect(within(dialog).queryByText(/PDF, Excel, CSV/)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Выбрать файл/ })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('switch', { name: 'Автообновление источника' })).toBeChecked()
    expect(within(dialog).getByRole('combobox', { name: 'Период автообновления' })).toHaveTextContent('Раз в неделю')

    fireEvent.click(within(dialog).getByRole('switch', { name: 'Автообновление источника' }))
    expect(within(dialog).getByRole('combobox', { name: 'Период автообновления' })).toBeDisabled()
  })

  it('checks the link before adding: rejects a malformed address, reports reachability', async () => {
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Ссылка' }))
    const url = within(dialog).getByLabelText(/^Ссылка на источник/)
    const check = within(dialog).getByRole('button', { name: 'Проверить ссылку на источник' })

    fireEvent.change(url, { target: { value: 'moros.ru/catalog' } })
    fireEvent.click(check)
    expect(url).toHaveAccessibleDescription(/Это не похоже на адрес страницы/)

    fireEvent.change(url, { target: { value: 'https://moros.ru/catalog/amr-800' } })
    fireEvent.click(check)
    expect(await within(dialog).findByText(/^Страница открывается · изменена/)).toBeInTheDocument()

    fireEvent.change(url, { target: { value: 'https://moros.invalid/amr-800' } })
    expect(url).toHaveAccessibleDescription('Официальный сайт производителя, техпаспорт или публичный каталог')
    fireEvent.click(check)
    expect(await within(dialog).findByText(/Страница не открылась/)).toBeInTheDocument()
  })

  it('adds a link source with the chosen period and shows it in the registry', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.admin, 'createDataSource')
    const dialog = await openDialog(services)
    await fillValidForm(dialog)
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Ссылка' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))
    expect(within(dialog).getByLabelText(/^Ссылка на источник/)).toHaveAccessibleDescription(/Вставьте ссылку/)
    expect(create).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/^Ссылка на источник/), { target: { value: 'https://moros.ru/catalog/amr-800' } })
    fireEvent.keyDown(within(dialog).getByRole('combobox', { name: 'Период автообновления' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('option', { name: 'Раз в месяц' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить источник' }))

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      locator: { kind: 'url', url: 'https://moros.ru/catalog/amr-800' }, refresh: 'monthly',
    }))
    const row = await rowOf('Данные поставщика «Морос», ТТХ AMR 800')
    expect(row.getByText('раз в месяц')).toBeInTheDocument()
    expect(row.getByRole('switch')).toBeEnabled()
  })

  it('closes on «Отмена» without adding anything', async () => {
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(await bodyRows()).toHaveLength(7)
  })

  it('is closed for a regular user (PRD 5.3)', async () => {
    renderPage('?as=user')
    expect(await screen.findByText('Раздел недоступен для роли «Пользователь»')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
