import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { NEW_LOCATION_SAMPLE } from '@/mocks/fixtures/newLocation'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LocationPage } from './LocationPage'

const renderPage = (path = '/locations/LOC-01', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/locations/:locationId" element={<LocationPage />} />
            <Route path="/locations/:locationId/processes" element={<LocationPage />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const cards = async () => within(await screen.findByRole('list', { name: 'Процессы локации «РЦ Химки»' })).getAllByRole('article')
const card = async (name: string) => within(await screen.findByRole('article', { name }))

describe('LocationPage (экраны 15 и 17)', () => {
  it('shows the location header from the profile (PRD 10.3)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })).toBeInTheDocument()
    expect(screen.getByText('Склад')).toBeInTheDocument()
    expect(screen.getByText('Москва · 20 000 м² · 180 сотрудников · 2 смены × 11 ч')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Локации' })).toHaveAttribute('href', '/locations')
  })

  it('shows three tabs with «Процессы локации» active', async () => {
    renderPage()
    const tabs = within(await screen.findByRole('navigation', { name: 'Разделы локации' }))
    expect(tabs.getByRole('link', { name: 'Параметры объекта' })).toHaveAttribute('href', '/locations/LOC-01/params')
    expect(tabs.getByRole('link', { name: 'Процессы локации' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('link', { name: 'Процессы локации' })).toHaveAttribute('href', '/locations/LOC-01/processes')
    expect(tabs.getByRole('link', { name: 'Документы' })).toHaveAttribute('href', '/locations/LOC-01/documents')
  })

  it('shows the same tab on its own address (экран 17)', async () => {
    renderPage('/locations/LOC-01/processes')
    const tabs = within(await screen.findByRole('navigation', { name: 'Разделы локации' }))
    expect(tabs.getByRole('link', { name: 'Процессы локации' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('link', { name: 'Параметры объекта' })).not.toHaveAttribute('aria-current')
    expect(await cards()).toHaveLength(5)
  })

  describe('пустая вкладка (locprocsempty, D-40)', () => {
    const renderEmpty = async (query = '') => {
      const services = createMockServices({ latencyMs: 0 })
      const created = await services.locations.createLocation(NEW_LOCATION_SAMPLE)
      renderPage(`/locations/${created.id}/processes${query}`, services)
    }

    it('offers to add a process instead of search and filters', async () => {
      await renderEmpty()
      expect(await screen.findByRole('heading', { name: 'На этой локации ещё нет процессов' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Процессы объекта · ещё ничего не добавлено' })).toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Добавить процесс' }))
      expect(await screen.findByRole('dialog', { name: 'Процесс из шаблона' })).toBeInTheDocument()
    })

    it('shows the first added process as a card', async () => {
      await renderEmpty()
      fireEvent.click(await screen.findByRole('button', { name: 'Добавить процесс' }))
      const dialog = within(await screen.findByRole('dialog', { name: 'Процесс из шаблона' }))
      fireEvent.click(dialog.getByRole('button', { name: /^Добавить «Перемещение паллет»/ }))
      const list = await screen.findByRole('list', { name: 'Процессы локации «РЦ Подольск»' })
      expect(within(list).getAllByRole('article')).toHaveLength(1)
      expect(screen.queryByText('На этой локации ещё нет процессов')).not.toBeInTheDocument()
    })

    it('hides adding from a guest', async () => {
      await renderEmpty('?as=guest')
      expect(await screen.findByText('На этой локации ещё нет процессов')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Добавить процесс' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Создать процесс' })).not.toBeInTheDocument()
    })
  })

  it('shows all five processes of the location (PRD 15 · №41)', async () => {
    renderPage()
    expect(await cards()).toHaveLength(5)
  })

  it('fills a card with location values, selection and readiness (PRD 10.4)', async () => {
    renderPage()
    const pallets = await card('Перемещение паллет')
    expect(pallets.getByText('Выбран')).toBeInTheDocument()
    expect(pallets.getByText('OP-01 · Перемещение грузов')).toBeInTheDocument()
    expect(pallets.getByText('Готово к расчёту · 9/9')).toBeInTheDocument()
    expect(pallets.getByRole('link', { name: 'Подробнее о процессе «Перемещение паллет» на локации' }))
      .toHaveAttribute('href', '/locations/LOC-01/processes/LP-01')

    const packing = await card('Упаковка')
    expect(packing.getByText('833 заказов / сут')).toBeInTheDocument()
    expect(packing.getByText('Не хватает 1: оклад')).toBeInTheDocument()
    expect(packing.queryByText('Выбран')).not.toBeInTheDocument()

    expect((await card('Инвентаризация')).getByText('Не хватает 2: исполнители, оклад')).toBeInTheDocument()
  })

  describe('окно 17в «Удалить процесс с локации» (PRD 10.4)', () => {
    const openRemove = async (name: string) => {
      const remove = (await card(name)).getByRole('button', { name: `Удалить процесс «${name}» с локации` })
      remove.focus()
      fireEvent.click(remove)
      return screen.findByRole('dialog', { name: `Удалить «${name}» с РЦ Химки?` })
    }

    it('explains that only this location changes', async () => {
      renderPage()
      const dialog = await openRemove('Упаковка')
      expect(dialog).toHaveAccessibleDescription(
        'Процесс удалится только с этой локации. Шаблон в разделе «Процессы» и другие локации не изменятся',
      )
      expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
    })

    it('keeps the card when cancelled and returns focus to «Удалить»', async () => {
      renderPage()
      const dialog = await openRemove('Упаковка')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
      await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
      expect(await cards()).toHaveLength(5)
      const remove = (await card('Упаковка')).getByRole('button', { name: 'Удалить процесс «Упаковка» с локации' })
      await waitFor(() => { expect(remove).toHaveFocus() })
    })

    it('removes the process from the location, announces it and moves focus to the heading', async () => {
      renderPage()
      const dialog = await openRemove('Упаковка')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить с локации' }))
      await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
      await waitFor(async () => { expect(await cards()).toHaveLength(4) })
      expect(screen.queryByRole('article', { name: 'Упаковка' })).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('«Упаковка» удалён с локации')
      await waitFor(() => { expect(screen.getByRole('heading', { level: 1, name: 'РЦ Химки' })).toHaveFocus() })
    })

    it('keeps the dialog open with a message when removal fails', async () => {
      const services = createMockServices({ latencyMs: 0 })
      const failing: Services = {
        ...services,
        locations: { ...services.locations, removeLocationProcess: () => Promise.reject(new Error('down')) },
      }
      renderPage('/locations/LOC-01', failing)
      const dialog = await openRemove('Упаковка')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить с локации' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось удалить процесс')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('article', { name: 'Упаковка', hidden: true })).toBeInTheDocument()
    })
  })

  it('searches location processes by name and description', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти процесс' }), { target: { value: 'запечатыв' } })
    expect((await cards()).map((c) => within(c).getByRole('heading').textContent)).toEqual(['Упаковка'])
  })

  it('offers to reset filters when nothing matches', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти процесс' }), { target: { value: 'нет такого' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(await cards()).toHaveLength(5)
  })

  it('links «Создать процесс» to the process form 09а', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Создать процесс' })).toHaveAttribute('href', '/processes/new')
  })

  it('hides creation and removal from a guest (D-14, D-30)', async () => {
    renderPage('/locations/LOC-01?as=guest')
    await cards()
    expect(screen.queryByRole('link', { name: 'Создать процесс' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Удалить/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('hides adding from a template from a guest (D-14)', async () => {
    renderPage('/locations/LOC-01?as=guest')
    await cards()
    expect(screen.queryByRole('button', { name: 'Добавить процесс из шаблона' })).not.toBeInTheDocument()
  })

  describe('окно 15а «Процесс из шаблона» (PRD 10.4)', () => {
    const openPicker = async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Добавить процесс из шаблона' }))
      return within(await screen.findByRole('dialog', { name: 'Процесс из шаблона' }))
    }

    it('explains that a copy is bound to this location', async () => {
      renderPage()
      const dialog = await openPicker()
      expect(dialog.getByText('Копия шаблона привяжется к РЦ Химки: значения настроите под эту локацию, справочник не изменится'))
        .toBeInTheDocument()
      expect(dialog.getByRole('link', { name: 'Создать процесс' })).toHaveAttribute('href', '/processes/new')
    })

    it('lists available templates first and keeps those on the location unavailable', async () => {
      renderPage()
      const dialog = await openPicker()
      const rows = within(dialog.getByRole('list', { name: 'Шаблоны процессов' })).getAllByRole('listitem')
      expect(rows).toHaveLength(12)
      expect(dialog.getAllByText('уже на локации')).toHaveLength(5)
      expect(dialog.queryByRole('button', { name: 'Добавить «Упаковка» на локацию' })).not.toBeInTheDocument()
      expect(dialog.getByRole('button', { name: 'Добавить «Сортировка грузов» на локацию' })).toBeInTheDocument()
    })

    it('searches templates and shows an empty state when nothing matches', async () => {
      renderPage()
      const dialog = await openPicker()
      fireEvent.change(dialog.getByRole('searchbox', { name: 'Найти шаблон процесса' }), { target: { value: 'нет такого' } })
      expect(dialog.getByText('Шаблон не найден')).toBeInTheDocument()
    })

    it('binds a template copy to the location and shows its card', async () => {
      renderPage()
      const dialog = await openPicker()
      fireEvent.click(dialog.getByRole('button', { name: 'Добавить «Сортировка грузов» на локацию' }))
      await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
      expect(await cards()).toHaveLength(6)
      expect(await card('Сортировка грузов')).toBeTruthy()
    })

    it('keeps the dialog open with a message when adding fails', async () => {
      const services = createMockServices({ latencyMs: 0 })
      const failing: Services = {
        ...services,
        locations: { ...services.locations, addLocationProcess: () => Promise.reject(new Error('down')) },
      }
      renderPage('/locations/LOC-01', failing)
      const dialog = await openPicker()
      fireEvent.click(dialog.getByRole('button', { name: 'Добавить «Сортировка грузов» на локацию' }))
      expect(await dialog.findByRole('alert')).toHaveTextContent('Не удалось добавить процесс')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('shows «not found» for an unknown location', async () => {
    renderPage('/locations/LOC-99')
    expect(await screen.findByText('Локация не найдена')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К списку локаций' })).toHaveAttribute('href', '/locations')
  })

  it('shows an error with retry when the service fails (D-07)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    const failing: Services = { ...services, projects: { ...services.projects, listProjects: () => Promise.reject(new Error('down')) } }
    renderPage('/locations/LOC-01', failing)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить локацию')
  })
})
