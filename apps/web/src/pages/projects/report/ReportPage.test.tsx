import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ru } from '@/shared/i18n/ru'
import { ReportPage } from './ReportPage'

const renderAt = (path: string) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={createMockServices({ latencyMs: 0 })}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/report" element={<ReportPage />} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )
}

const SECTION_TITLES = Object.values(ru.report.sections).map((title, i) => `${String(i + 1)}. ${title}`)

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('Отчёт PDF (экран 09, PRD 11.6, D-107)', () => {
  it('черновик: 12 разделов PRD по порядку, дисклеймер ТЗ 3.7.5 и пять показателей 08', async () => {
    renderAt('/projects/PJ-DEMO/report?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: ru.report.title })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(SECTION_TITLES)
    expect(screen.getByRole('note', { name: ru.project.economics.footer.disclaimer })).toBeInTheDocument()
    const tiles = within(screen.getByRole('list', { name: 'Пять показателей' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(tiles.join(' ')).toMatch(/6,1\sмлн.*825\sтыс.*42,0\sмлн.*9,2\sмлн.*0,7\sгода/su)
    expect(screen.getByText(ru.report.toolbar.draft)).toBeInTheDocument()
  })

  it('таблица первой страницы: девять строк PRD, условия решения и статус черновика', async () => {
    renderAt('/projects/PJ-DEMO/report?as=user')
    const table = await screen.findByRole('table', { name: ru.report.summary.tableCaption })
    const rows = within(table).getAllByRole('row')
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual(Object.values(ru.report.summary.rows))
    expect(within(table).getByRole('row', { name: /^Условия решения/u })).toHaveTextContent(/Допустимая нагрузка на пол; Покрытие Wi-Fi на маршрутах; Интеграция с WMS/u)
    expect(within(table).getByRole('row', { name: /^Статус/u })).toHaveTextContent('Целесообразно при выполнении условий · черновик')
  })

  it('экономическое сравнение — те же строки, что на итоге 08: TCO трёх сценариев', async () => {
    renderAt('/projects/PJ-DEMO/report?as=user')
    const table = await screen.findByRole('table', { name: ru.report.economics.caption })
    expect(within(table).getByRole('row', { name: /^TCO за 5\sлет/u })).toHaveTextContent(/256,0.*219,9.*216,1/su)
  })

  it('матрица применимости: жёсткие условия пройдены, условия площадки без данных', async () => {
    renderAt('/projects/PJ-DEMO/report?as=user')
    const table = await screen.findByRole('table', { name: /^Проверки применимости: AMR 800 · RaaS/u })
    expect(within(table).getByRole('row', { name: /^Класс операции/u })).toHaveTextContent('соответствует')
    expect(within(table).getByRole('row', { name: /^Допустимая нагрузка на пол/u })).toHaveTextContent('нет данных')
  })

  it('«Сохранить как PDF» открывает печать браузера', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    renderAt('/projects/PJ-DEMO/report?as=user')
    fireEvent.click(await screen.findByRole('button', { name: ru.report.toolbar.print }))
    expect(print).toHaveBeenCalledOnce()
  })

  it('сохранённая оценка: подсказка о сохранённой версии и статус со снимком', async () => {
    renderAt('/projects/PJ-01/report?as=user')
    expect(await screen.findByText(/^Версия расчёта .* сохранена/u)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: ru.report.summary.tableCaption })
    expect(within(table).getByRole('row', { name: /^Статус/u })).toHaveTextContent(/оценка сохранена/u)
  })

  it('гость: отчёт доступен, оценка не сохраняется (D-14)', async () => {
    renderAt('/projects/PJ-DEMO/report?as=guest')
    expect(await screen.findByText(ru.report.toolbar.guest)).toBeInTheDocument()
  })

  it('неизвестный проект — «Проект не найден»', async () => {
    renderAt('/projects/PJ-NOPE/report?as=user')
    expect(await screen.findByText(ru.report.notFound.title)).toBeInTheDocument()
  })
})
