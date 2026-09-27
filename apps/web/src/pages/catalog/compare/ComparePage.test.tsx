import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { CompareEntry } from '@/domain'
import { createMockServices } from '@/services/mock'
import { COMPARE_STORAGE_KEY } from '@/services/mock/compare'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from '@/shared/compare/CompareProvider'
import { ComparePage } from './ComparePage'

function Address() {
  const { pathname, search } = useLocation()
  return <output data-testid="address">{pathname + search}</output>
}

const renderPage = (entries: readonly CompareEntry[], state?: unknown) => {
  sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(entries))
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/catalog/compare', state }]}>
      <ServicesProvider services={createMockServices({ latencyMs: 0 })}>
        <RoleProvider>
          <CompareProvider>
            <Routes>
              <Route path="/catalog/compare" element={<ComparePage />} />
              <Route path="*" element={null} />
            </Routes>
            <Address />
          </CompareProvider>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )
}

const TWO: readonly CompareEntry[] = [{ kind: 'robot', id: 'RB-0007' }, { kind: 'robot', id: 'RB-0008' }]
const table = async () => within(await screen.findByRole('table', { name: 'Сравнение выбранных позиций каталога' }))
/** Колонки позиций — шапка таблицы; заголовки групп строк тоже columnheader (scope=colgroup). */
const columns = async () => within((await table()).getAllByRole('rowgroup')[0] as HTMLElement).getAllByRole('columnheader').map((h) => h.getAttribute('aria-label'))

afterEach(() => { sessionStorage.clear() })

describe('ComparePage (экран К-3)', () => {
  it('shows one column per chosen position, the counter and the grey hint (PRD 7.6)', async () => {
    renderPage(TWO)
    const grid = await table()
    expect(await columns()).toEqual(['AMR 100', 'AMR 800'])
    expect(screen.getByText('2 из 4 выбрано')).toBeInTheDocument()
    expect(screen.getByText(/ячейки без подтверждённых данных показаны серым/)).toBeInTheDocument()
    expect(grid.getByRole('rowheader', { name: 'Роль в конфигурации' })).toBeInTheDocument()
    expect(grid.getByText('Соответствие · РЦ Химки')).toBeInTheDocument()
    expect(grid.getByText('груз: 800 > 100 кг')).toBeInTheDocument()
  })

  it('removes a column with the cross and clears the whole set', async () => {
    renderPage(TWO)
    fireEvent.click((await table()).getByRole('button', { name: 'Убрать из сравнения: AMR 100' }))
    await waitFor(() => { expect(screen.getByText('1 из 4 выбрано')).toBeInTheDocument() })
    expect(await columns()).toEqual(['AMR 800'])
    fireEvent.click(screen.getByRole('button', { name: 'Очистить сравнение' }))
    expect(await screen.findByText('В сравнении пока ничего нет')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить сравнение' })).toBeDisabled()
  })

  it('leads «Проверить на объекте» to a new project with the chosen solution (D-57, D-75)', async () => {
    renderPage(TWO)
    expect((await table()).getByRole('link', { name: 'Проверить на объекте: AMR 800' })).toHaveAttribute('href', '/projects?new=1&solution=RB-0008')
  })

  it('returns to the catalog selection it came from', async () => {
    renderPage(TWO, { catalogSearch: '?class=OP-01' })
    await table()
    expect(screen.getByRole('link', { name: 'Назад к результатам' })).toHaveAttribute('href', '/catalog?class=OP-01')
  })

  it('compares a robot with a launch item: robot rows are «не применимо» for the item', async () => {
    renderPage([{ kind: 'robot', id: 'RB-0008' }, { kind: 'launch-item', id: 'SI-SW-01' }])
    const grid = await table()
    expect(await columns()).toEqual(['AMR 800', 'Fleet Manager'])
    expect(grid.getByText('1 лицензия на парк')).toBeInTheDocument()
    expect(grid.getAllByText('не применимо').length).toBeGreaterThan(0)
  })
})
