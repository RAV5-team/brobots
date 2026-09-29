import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LOCATION_DRAFT_KEY, LocationNewPage } from './LocationNewPage'

function LocationsList() {
  const state: unknown = useLocation().state
  return <p>{`list ${JSON.stringify(state)}`}</p>
}

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/locations/new${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/locations/new" element={<LocationNewPage />} />
            <Route path="/locations" element={<LocationsList />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

/** Значение строки панели готовности: <dd> рядом с подписью. */
const railValue = (label: string) => screen.getByText(label).nextElementSibling

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('LocationNewPage (экран 14)', () => {
  it('renders four sections, the section nav and computed readiness (PRD 10.2)', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Новая локация' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Разделы формы' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)?.slice(0, 4)).toEqual(['Основное', 'Площадь и этажность', 'Режим', 'Персонал'])
    expect(screen.getByRole('heading', { level: 2, name: '1. Основное' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Объём приёмки/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Проходы и высота/ })).toBeInTheDocument()
    expect(screen.getByText('9 / 9')).toBeInTheDocument()
    expect(railValue('Ошибки')).toHaveTextContent('0')
    expect(railValue('Допущения')).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: 'Локации' })).toHaveAttribute('href', '/locations')
  })

  it('shows the area error live and jumps to the field from the readiness panel', async () => {
    renderPage('?as=user')
    const active = await screen.findByRole('textbox', { name: /Площадь активной/ })
    fireEvent.change(active, { target: { value: '22 000' } })
    expect(active).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Больше общей площади склада/)).toBeInTheDocument()
    expect(screen.getByText('8 / 9')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к первой ошибке' }))
    expect(active).toHaveFocus()
  })

  it('adds and removes staff groups', async () => {
    renderPage('?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить группу персонала' }))
    expect(screen.getByRole('textbox', { name: 'Название группы персонала' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Удалить группу «новая группа»' }))
    expect(screen.queryByRole('textbox', { name: 'Название группы персонала' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Удалить группу «Операторы упаковочных линий»' }))
    expect(screen.queryByText('Операторы упаковочных линий')).not.toBeInTheDocument()
  })

  it('stores the draft for users and restores it on the next visit (D-21)', async () => {
    const first = renderPage('?as=user')
    expect(await screen.findByText(/^Черновик сохранён · \d\d:\d\d$/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /Название/ }), { target: { value: 'РЦ Подольск' } })
    await waitFor(() => { expect(localStorage.getItem(LOCATION_DRAFT_KEY)).toContain('РЦ Подольск') })
    first.unmount()
    renderPage('?as=user')
    expect(await screen.findByRole('textbox', { name: /Название/ })).toHaveValue('РЦ Подольск')
  })

  it('blocks saving for guests and does not write a draft (D-14)', async () => {
    renderPage('?as=guest')
    expect(await screen.findByRole('button', { name: /Сохранить/ })).toBeDisabled()
    expect(screen.getByText('В демо-режиме локации не сохраняются: войдите в рабочий кабинет')).toBeInTheDocument()
    expect(localStorage.getItem(LOCATION_DRAFT_KEY)).toBeNull()
  })

  it('replaces sections 2–4 with a notice for types without a drawn form (D-36)', async () => {
    renderPage('?as=user')
    fireEvent.click(await screen.findByRole('radio', { name: 'Аэропорт' }))
    expect(screen.getByText('Разделы для типа «Аэропорт» ещё не готовы')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '2. Площадь и этажность' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Сохранить/ })).toBeDisabled()
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('reports required fields on submit and focuses the first one', async () => {
    renderPage('?as=user')
    const name = await screen.findByRole('textbox', { name: /Название/ })
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }))
    expect(await screen.findByText('Проверьте поля с ошибками: 1')).toBeInTheDocument()
    expect(name).toHaveFocus()
  })

  it('fills the form from an edited location template', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Новая локация' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скачать шаблон' })).toBeEnabled()
    const csv = [
      'Код параметра;Группа;Параметр;Ед. изм.;Значение',
      'loc_name;Основное;Название;;РЦ Подольск',
      'wh_total_area;Площадь;Общая площадь;;15 000',
    ].join('\n')
    const file = new File([csv], 'шаблон-локации.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Файл шаблона локации'), { target: { files: [file] } })
    expect(await screen.findByRole('textbox', { name: /Название/ })).toHaveValue('РЦ Подольск')
    expect(screen.getByRole('textbox', { name: /Общая площадь склада/ })).toHaveValue('15 000')
    expect(screen.getByText('В форму перенесено значений: 2')).toBeInTheDocument()
  })

  it('creates the location, clears the draft and opens the list in the 12а state', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.locations, 'createLocation')
    renderPage('?as=user', services)
    fireEvent.click(await screen.findByRole('button', { name: /Сохранить/ }))
    expect(await screen.findByText(/^list .*createdLocationId.*LOC-05/)).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'РЦ Химки', facilityType: 'warehouse' }))
    expect(localStorage.getItem(LOCATION_DRAFT_KEY)).toBeNull()
  })
})
