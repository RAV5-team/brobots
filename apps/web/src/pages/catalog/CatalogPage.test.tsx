import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from '@/shared/compare/CompareProvider'
import { CatalogPage } from './CatalogPage'

function Address() {
  const { pathname, search } = useLocation()
  return <output data-testid="address">{pathname + search}</output>
}

const renderPage = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/catalog${search}`]}>
      <ServicesProvider services={createMockServices({ latencyMs: 0 })}>
        <RoleProvider>
          <CompareProvider>
            <Routes>
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="*" element={null} />
            </Routes>
            <Address />
          </CompareProvider>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const cards = async () => within(await screen.findByRole('list', { name: 'Позиции каталога' })).getAllByRole('article')
const card = async (name: string) => within(await screen.findByRole('article', { name }))

afterEach(() => { sessionStorage.clear() })

describe('CatalogPage (экран К-1)', () => {
  it('shows every robot on the default tab (PRD 7.1, D-55)', async () => {
    renderPage()
    expect(await cards()).toHaveLength(ROBOTS.length)
    expect(screen.getByRole('heading', { level: 1, name: 'Каталог роботизированных решений' })).toBeInTheDocument()
  })

  it('shows a robot card as in К-1: class, payload, price, TRL and «Для запуска» (PRD 7.2, D-63)', async () => {
    renderPage()
    const amr = await card('AMR 100')
    expect(amr.getByText('ООО «Морос» · AMR')).toBeInTheDocument()
    expect(amr.getByText('OP-01 Перемещение грузов')).toBeInTheDocument()
    expect(amr.getByText('до 100 кг')).toBeInTheDocument()
    expect(amr.getByText('1,50 млн ₽')).toBeInTheDocument()
    expect(amr.getByText('УГТ 9 · эксплуатация')).toBeInTheDocument()
    expect(within(amr.getByRole('list', { name: 'Для запуска' })).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['зарядка', 'Fleet Manager', 'внедрение'])
    expect(amr.getByRole('img', { name: 'Фото: AMR 100' })).toHaveAttribute('src', '/catalog/rb-0007.webp')
    expect((await card('AS-RS P')).getByText('нет данных')).toBeInTheDocument()
  })

  it('switches the tab to launch items and keeps it in the address', async () => {
    renderPage()
    await cards()
    fireEvent.click(screen.getByRole('radio', { name: 'ПО и интеграции' }))
    expect(await cards()).toHaveLength(6)
    expect(screen.getByTestId('address')).toHaveTextContent('/catalog?tab=software')
    const fleet = await card('Fleet Manager')
    expect(fleet.getByText('1,10 млн ₽')).toBeInTheDocument()
    expect(fleet.getByText('CAPEX')).toBeInTheDocument()
    expect(fleet.getByRole('link', { name: 'AK-2000-2' })).toHaveAttribute('href', '/catalog/RB-0014')
  })

  it('links known compatible positions and writes the rest as text (D-65)', async () => {
    renderPage('?tab=infrastructure')
    expect((await card('Конвейер выдачи, 12 м')).queryByRole('link', { name: 'SmartCube' })).toBeNull()
    expect((await card('Конвейер выдачи, 12 м')).getByText('SmartCube')).toBeInTheDocument()
  })

  it('disables robot-only filters on launch item tabs (D-72)', async () => {
    renderPage('?tab=services')
    await cards()
    expect(screen.getByRole('button', { name: 'Класс операции' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Стоимость' })).toBeEnabled()
  })

  it('reads filters from the address and offers to reset them when nothing is found', async () => {
    renderPage('?q=нет-такого&readiness=rnd')
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Готовность: НИОКР' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(await cards()).toHaveLength(ROBOTS.length)
  })

  it('shows К-2: the active class filter, «Сбросить» and only OP-01 robots (PRD 7.4)', async () => {
    renderPage('?class=OP-01&q=amr')
    const filter = await screen.findByRole('button', { name: 'Класс операции: OP-01' })
    expect(filter).toHaveAttribute('data-active', 'true')
    expect((await cards()).map((c) => c.getAttribute('aria-label'))).toEqual(expect.arrayContaining(['AMR 100', 'AMR 800']))
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.getByTestId('address')).toHaveTextContent('/catalog?q=amr')
    expect(screen.queryByRole('button', { name: 'Сбросить' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Класс операции' })).toHaveAttribute('data-active', 'false')
  })

  it('adds positions to the comparison, counts them and stops at four (D-58, D-67)', async () => {
    renderPage()
    await cards()
    expect(screen.getByRole('button', { name: 'Сравнить (0)' })).toBeEnabled()
    const compare = (name: string) => screen.getByRole('button', { name: new RegExp(`^(Сравнить|В сравнении): ${name}$`) })
    for (const name of ['AMR 100', 'AMR 800', 'AMR 1500', 'Курьер-30']) fireEvent.click(compare(name))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Сравнить (4)' })).toBeEnabled() })
    expect(compare('AMR 100')).toHaveAttribute('aria-pressed', 'true')
    expect(compare('РУБИ-С-03')).toBeDisabled()
    fireEvent.click(compare('AMR 100'))
    await waitFor(() => { expect(compare('РУБИ-С-03')).toBeEnabled() })
    fireEvent.click(screen.getByRole('button', { name: 'Сравнить (3)' }))
    expect(screen.getByTestId('address')).toHaveTextContent('/catalog/compare')
  })
})
