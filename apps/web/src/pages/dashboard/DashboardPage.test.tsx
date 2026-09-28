import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { DashboardPage } from './DashboardPage'

// Intl и словарь ставят неразрывные пробелы и U+2060 вокруг «/» — сравниваем по видимому тексту.
const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/\u2060/g, '')

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <DashboardPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

describe('DashboardPage (экран 06)', () => {
  it('shows the version line of the data the numbers are built on (PRD 8.1)', async () => {
    renderPage()
    expect(await screen.findByText('Демо-организация · снимок данных 15.09.2026 · каталог v4 · модель 2.1')).toBeInTheDocument()
  })

  it('computes the four indicators from the services (PRD 8.2, D-13)', async () => {
    renderPage()
    const kpis = within(await screen.findByRole('region', { name: 'Показатели' }))
    const cards = kpis.getAllByRole('article').map((a) => plain(a.textContent))
    expect(cards).toEqual([
      'Локаций4склад, аэропорт, медучреждение',
      'Проектов7из них рассчитано 4',
      'Ручная работа на локациях591 млн ₽сумма по всем объектам, ₽/год',
      'Найденная экономия17 млн ₽по лучшему проекту на каждый процесс, ₽/год',
    ])
  })

  it('announces the checks and keeps «Открыть» disabled until the checks screen exists (D-29)', async () => {
    renderPage()
    const checks = within(await screen.findByRole('region', { name: 'Уточнения и проверки' }))
    expect(plain(checks.getByText(/Подтвердить/).textContent)).toBe(
      'Подтвердить допустимую нагрузку на пол · Проверить покрытие Wi‑Fi на маршрутах и ещё 6',
    )
    expect(checks.getByRole('button', { name: 'Открыть проверки: 8' })).toBeDisabled()
  })

  it('lists recent projects with status, result and a link to the step or the saved assessment', async () => {
    renderPage()
    const panel = within(await screen.findByRole('region', { name: 'Продолжить' }))
    const rows = panel.getAllByRole('listitem').map((li) => plain(li.textContent))
    expect(rows).toEqual([
      'Роботизация паллетного потока · РЦ ХимкиРЦ Химки · изменён 15.09 14:32Результат0,7 года · 9,2 млн ₽/год',
      'Только уборка · РЦ ХимкиРЦ Химки · изменён 14.09 18:05Параметры—',
      'Комплектация заказов · Даркстор ЮгДаркстор Юг · изменён 13.09 11:20Результат1,6 года',
    ])
    expect(panel.getByRole('link', { name: 'Открыть проект «Только уборка · РЦ Химки»' })).toHaveAttribute('href', '/projects/PJ-02/params')
    expect(panel.getByRole('link', { name: 'Открыть проект «Роботизация паллетного потока · РЦ Химки»' })).toHaveAttribute('href', '/projects/PJ-01/economics')
    expect(panel.getByRole('link', { name: 'Все проекты' })).toHaveAttribute('href', '/projects')
  })

  it('lists three locations with labor cost, type and project count', async () => {
    renderPage()
    const panel = within(await screen.findByRole('region', { name: 'Локации' }))
    expect(panel.getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual([
      'РЦ Химки231 млн ₽ ручной работыскладпроектов: 4',
      'Даркстор Юг84 млн ₽ ручной работыскладпроектов: 1',
      'Терминал Внуково-2183 млн ₽ ручной работыаэропортпроектов: 1',
    ])
    expect(panel.getByRole('link', { name: 'РЦ Химки' })).toHaveAttribute('href', '/locations/LOC-01')
    expect(panel.getByRole('link', { name: 'Добавить локацию' })).toHaveAttribute('href', '/locations/new')
  })

  it('shows demo data to the guest without adding locations (PRD 5.3, D-14)', async () => {
    renderPage('?as=guest')
    expect(await screen.findByText(/^Демо-данные организатора · снимок данных/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Добавить локацию' })).not.toBeInTheDocument()
  })

  it('shows an error with retry and recovers (D-07)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const getInputs = vi.spyOn(services.dashboard, 'getInputs').mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('', services)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить дашборд')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('region', { name: 'Продолжить' })).toBeInTheDocument()
    expect(getInputs).toHaveBeenCalledTimes(2)
  })
})
