import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectsPage } from './ProjectsPage'

function WhereAmI() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/projects${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects" element={<><ProjectsPage /><WhereAmI /></>} />
            <Route path="*" element={<WhereAmI />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const plain = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()
const bodyRows = async () => {
  const table = await screen.findByRole('table', { name: 'Проекты' })
  return within(table).getAllByRole('row').slice(1)
}
const texts = async () => (await bodyRows()).map((r) => within(r).getAllByRole('cell').map((c) => plain(c.textContent)).filter(Boolean).join(' | '))

afterEach(() => { sessionStorage.clear() })

describe('ProjectsPage (экран A1)', () => {
  it('lists every project with columns of the board and values of the snapshot', async () => {
    renderPage('?as=user')
    expect(screen.getByRole('heading', { level: 1, name: 'Проекты' })).toBeInTheDocument()
    expect(await texts()).toEqual([
      'Роботизация паллетного потока · РЦ Химки | РЦ Химки | Оценка готова | 6,1 млн ₽ | 42,0 млн ₽ | 0,7 года',
      'Только уборка · РЦ Химки | РЦ Химки | Черновикостановились на: Параметры | — | — | —',
      'Комплектация заказов · Даркстор Юг | Даркстор Юг | Оценка готова | 52,4 млн ₽ | 21,3 млн ₽ | 1,6 года',
      'Багаж терминала · Внуково-2 | Терминал Внуково-2 | Черновикостановились на: Подбор | — | — | —',
      'Внутрибольничная логистика · ГКБ №17 | ГКБ №17 | Оценка готова | 84,0 млн ₽ | 12,5 млн ₽ | 7,0 лет',
      'Паллетный поток v2 · РЦ Химки | РЦ Химки | Оценка готова | 47,4 млн ₽ | 34,5 млн ₽ | 2,8 года',
      'Инвентаризация · РЦ Химки | РЦ Химки | Черновикостановились на: Параметры | — | — | —',
    ])
    expect(screen.getByText(/^Черновик — оценка в работе/)).toBeInTheDocument()
  })

  it('shows computed counters on the tabs', async () => {
    renderPage('?as=admin')
    await bodyRows()
    expect(screen.getAllByRole('radio').map((tab) => plain(tab.textContent))).toEqual(['Все 7', 'Черновики 3', 'Готовые оценки 4'])
    expect(screen.getByRole('radio', { name: 'Все 7' })).toBeChecked()
  })

  it('switches the tab and keeps it in the address', async () => {
    renderPage('?as=user')
    await bodyRows()
    fireEvent.click(screen.getByRole('radio', { name: /Черновики/ }))
    expect(await bodyRows()).toHaveLength(3)
    expect(screen.getByTestId('location')).toHaveTextContent('/projects?tab=draft')
  })

  it('opens with the tab and query from the address', async () => {
    renderPage('?as=user&tab=saved&q=химки')
    expect((await texts()).map((t) => t.split(' | ')[0])).toEqual(['Роботизация паллетного потока · РЦ Химки', 'Паллетный поток v2 · РЦ Химки'])
    expect(screen.getByRole('searchbox', { name: 'Поиск по названию и объекту' })).toHaveValue('химки')
  })

  it('links a draft to its step and a saved assessment to the read-only view (D-17)', async () => {
    renderPage('?as=user')
    await bodyRows()
    expect(screen.getByRole('link', { name: 'Открыть проект «Багаж терминала · Внуково-2»' })).toHaveAttribute('href', '/projects/PJ-04/matching')
    expect(screen.getByRole('link', { name: 'Открыть проект «Роботизация паллетного потока · РЦ Химки»' })).toHaveAttribute('href', '/projects/PJ-01/economics')
  })

  it('opens a project by a click on its row', async () => {
    renderPage('?as=user')
    await bodyRows()
    fireEvent.click(screen.getByText('Инвентаризация · РЦ Химки'))
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/PJ-07/params')
  })

  it('shows the shared empty state when the search finds nothing and resets it', async () => {
    renderPage('?as=user')
    await bodyRows()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Казань' } })
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Показать все проекты' }))
    expect(await bodyRows()).toHaveLength(7)
  })

  it('shows the empty state without tabs when there are no projects', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const empty: Services = { ...services, projects: { ...services.projects, listProjects: () => Promise.resolve([]) } }
    renderPage('?as=user', empty)
    expect(await screen.findByText('Проектов пока нет')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('sends a guest to the catalog (D-82)', () => {
    renderPage('?as=guest')
    expect(screen.getByTestId('location')).toHaveTextContent('/catalog')
  })

  it('shows an error with retry when the service fails (D-07)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    const listProjects = vi.spyOn(services.projects, 'listProjects').mockRejectedValueOnce(new Error('down'))
    renderPage('?as=user', services)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить проекты')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await bodyRows()).toHaveLength(7)
    expect(listProjects).toHaveBeenCalledTimes(2)
  })
})
