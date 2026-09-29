import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { NEW_LOCATION_SAMPLE } from '@/mocks/fixtures/newLocation'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LocationsPage } from './LocationsPage'

type Entry = string | { readonly pathname: string; readonly search?: string; readonly state?: unknown }

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 }), entry?: Entry) =>
  render(
    <MemoryRouter initialEntries={[entry ?? `/locations${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <LocationsPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const cards = async () => within(await screen.findByRole('list', { name: 'Локации организации' })).getAllByRole('article')
const cardNames = async () => (await cards()).map((c) => within(c).getByRole('heading').textContent)
const textIs = (expected: string) => (_content: string, element: Element | null) =>
  element !== null && element.textContent.replace(/\s+/gu, ' ').trim() === expected

describe('LocationsPage (экран 12)', () => {
  it('shows the four demo locations, recently updated first (PRD 10.1)', async () => {
    renderPage()
    expect(await cardNames()).toEqual(['РЦ Химки', 'ГКБ №17', 'Терминал Внуково-2', 'Даркстор Юг'])
  })

  it('fills the РЦ Химки card from the profile, processes and projects', async () => {
    renderPage()
    const card = within(await screen.findByRole('article', { name: 'РЦ Химки' }))
    expect(card.getByText('Склад · Москва')).toBeInTheDocument()
    expect(card.getByText(textIs('3 допущения'))).toBeInTheDocument()
    expect(card.getByText(textIs('20 000 м²'))).toBeInTheDocument()
    expect(card.getByText('180 чел')).toBeInTheDocument()
    expect(card.getByText('2 × 11 ч')).toBeInTheDocument()
    expect(card.getByText(textIs('231 млн ₽ / год'))).toBeInTheDocument()
    expect(card.getByText(textIs('затраты на персонал · 145 человек в операционных процессах'))).toBeInTheDocument()
    expect(card.getByText('78 %')).toBeInTheDocument()
    expect(card.getByText('4 (2 завершено)')).toBeInTheDocument()
    expect(card.getByText('обновлено 14.09.2026')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Подробнее о локации «РЦ Химки»' })).toHaveAttribute('href', '/locations/LOC-01')
  })

  it('searches by city', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Локация, город или тип объекта' }), { target: { value: 'Ростов' } })
    expect(await cardNames()).toEqual(['Даркстор Юг'])
  })

  it('offers to reset filters when nothing matches', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Локация, город или тип объекта' }), { target: { value: 'нет такой' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(await cards()).toHaveLength(4)
  })

  it('links «Добавить локацию» to the form 14 for a user', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('link', { name: 'Добавить локацию' })).toHaveAttribute('href', '/locations/new')
  })

  it('hides adding a location from a guest (PRD 5.3, D-14)', async () => {
    renderPage('?as=guest')
    await cards()
    expect(screen.queryByRole('link', { name: 'Добавить локацию' })).not.toBeInTheDocument()
  })

  it('shows an error with retry when the service fails (D-07)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const failing: Services = {
      ...services,
      locations: { ...services.locations, listLocationSummaries: vi.fn().mockRejectedValue(new Error('offline')) },
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('', failing)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить локации')
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })
})

describe('LocationsPage · локация добавлена (экран 12а)', () => {
  /** Как форма 14: сохранить локацию и вернуться в список с её id в состоянии навигации. */
  async function renderAfterCreate() {
    const services = createMockServices({ latencyMs: 0 })
    const created = await services.locations.createLocation(NEW_LOCATION_SAMPLE)
    renderPage('', services, { pathname: '/locations', search: '?as=user', state: { createdLocationId: created.id } })
    return created
  }

  it('shows the success banner with the profile line from the dictionary (PRD 10.1; PRD 15 · №42)', async () => {
    const created = await renderAfterCreate()
    const banner = within(await screen.findByRole('status', { name: 'Локация «РЦ Подольск» создана' }))
    expect(banner.getByText(textIs('Склад · Подольск · 20 000 м² · 180 сотрудников · профиль заполнен на 83 % — добавьте процессы')))
      .toBeInTheDocument()
    expect(banner.queryByText(/RB-0224/)).not.toBeInTheDocument()
    expect(banner.getByRole('link', { name: 'Открыть локацию «РЦ Подольск»' })).toHaveAttribute('href', `/locations/${created.id}`)
  })

  it('puts the new card first with zero processes and projects, «создана только что» (PRD 15 · №43)', async () => {
    await renderAfterCreate()
    expect((await cardNames())[0]).toBe('РЦ Подольск')
    const card = within(screen.getByRole('article', { name: 'РЦ Подольск' }))
    expect(card.getByText('Процессов').nextElementSibling).toHaveTextContent('0')
    expect(card.getByText('Связанных проектов').nextElementSibling).toHaveTextContent(/^0$/)
    expect(card.getByText('создана только что')).toBeInTheDocument()
    expect(card.queryByText(/млн ₽/)).not.toBeInTheDocument()
    expect(card.getByText('Нет процессов — затраты посчитаются после их добавления')).toBeInTheDocument()
  })

  it('ignores the created state for a guest (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const created = await services.locations.createLocation(NEW_LOCATION_SAMPLE)
    renderPage('', services, { pathname: '/locations', search: '?as=guest', state: { createdLocationId: created.id } })
    await cards()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('создана только что')).not.toBeInTheDocument()
  })

  it('shows no banner on a plain visit or for an unknown location', async () => {
    renderPage('', undefined, { pathname: '/locations', state: { createdLocationId: 'LOC-99' } })
    await cards()
    expect(screen.queryByText(/создана$/)).not.toBeInTheDocument()
    expect(screen.queryByText('создана только что')).not.toBeInTheDocument()
  })
})
