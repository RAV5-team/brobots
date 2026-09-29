import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { EconomicsStep } from './EconomicsStep'

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/economics" element={<><ProjectStepPage step="economics" Step={EconomicsStep} /><Search /></>} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )
  return services
}

const recommendation = async () => screen.findByRole('region', { name: /^AMR 800 · / })
const tiles = (card: HTMLElement) => within(within(card).getByRole('list', { name: 'Пять показателей' })).getAllByRole('listitem').map((li) => li.textContent)
const footer = () => screen.getByRole('region', { name: 'Сохранение и выгрузки' })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 4 «Итог и экономика» (экран 08, PRD 11.5, D-106)', () => {
  it('черновик: рекомендация RaaS, пять показателей PRD и вывод «при выполнении условий»', async () => {
    renderAt('/projects/PJ-DEMO/economics?as=user')
    const card = await recommendation()
    expect(within(card).getByRole('heading', { name: 'AMR 800 · RaaS' })).toBeInTheDocument()
    expect(within(card).getByText('Рекомендация системы')).toBeInTheDocument()
    expect(within(card).getByText('Место 1 из 8')).toBeInTheDocument()
    expect(tiles(card).join(' ')).toMatch(/6,1\sмлн.*825\sтыс.*42,0\sмлн.*9,2\sмлн.*0,7\sгода/su)
    expect(within(card).getByText('Целесообразно при выполнении условий')).toBeInTheDocument()
    expect(within(card).getByText(/допустимая нагрузка на пол, покрытие Wi-Fi на маршрутах, интеграция с WMS/u)).toBeInTheDocument()
  })

  it('сравнение сценариев: текущий процесс, покупка и RaaS по PRD, метки лучших значений', async () => {
    renderAt('/projects/PJ-DEMO/economics?as=user')
    const table = await screen.findByRole('table', { name: 'Сравнение сценариев: текущий процесс, покупка и RaaS' })
    const headers = within(table).getAllByRole('columnheader').filter((th) => th.getAttribute('scope') === 'col').map((th) => th.getAttribute('aria-label'))
    expect(headers).toEqual(['Текущий процесс', 'Покупка', 'RaaS · Выбран'])
    expect(within(table).getByText('Минимум вложений')).toBeInTheDocument()
    expect(within(table).getByText('Меньше TCO')).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /^TCO за 5\sлет/u })).toHaveTextContent(/256,0.*219,9.*216,1/su)
  })

  it('переключатель в шапке показывает покупку (08a), выбор — только кнопкой «Выбрать этот сценарий»', async () => {
    const services = renderAt('/projects/PJ-DEMO/economics?as=user')
    await recommendation()
    fireEvent.click(screen.getByRole('radio', { name: 'Покупка' }))
    const card = await screen.findByRole('region', { name: 'AMR 800 · Покупка' })
    expect(screen.getByTestId('search')).toHaveTextContent('scenario=purchase')
    expect(tiles(card).join(' ')).toMatch(/47,4\sмлн.*Новые расходы в год.*2,8\sмлн.*34,5\sмлн.*16,7\sмлн.*2,8\sгода/su)
    expect((await services.projects.getProject('PJ-DEMO')).inputs.economics?.scenario).toBe('raas')
    fireEvent.click(within(card).getByRole('button', { name: 'Выбрать этот сценарий' }))
    await waitFor(async () => { expect((await services.projects.getProject('PJ-DEMO')).inputs.economics?.scenario).toBe('purchase') })
    expect(within(card).getByText('Выбрано')).toBeInTheDocument()
  })

  it('сохранение: снимок уходит в A1 с теми же числами, экран — только просмотр с «Новый расчёт на основе»', async () => {
    const services = renderAt('/projects/PJ-DEMO/economics?as=user')
    await recommendation()
    fireEvent.click(within(footer()).getByRole('button', { name: 'Сохранить оценку' }))
    expect(await within(footer()).findByRole('link', { name: 'Новый расчёт на основе' })).toHaveAttribute('href', expect.stringContaining('new=1'))
    expect(screen.queryByRole('button', { name: 'Выбрать этот сценарий' })).not.toBeInTheDocument()
    const listed = (await services.projects.listProjects()).find((p) => p.id === 'PJ-DEMO')
    expect(listed).toMatchObject({ status: 'saved', result: { capexRub: 6_100_000, opexRubPerYear: 42_000_000, paybackYears: 0.7 } })
  })

  it('запрос КП: окно подтверждения, затем «КП запрошено» вместо кнопки (08b)', async () => {
    renderAt('/projects/PJ-01/economics?as=user')
    await recommendation()
    fireEvent.click(within(footer()).getByRole('button', { name: 'Запросить КП' }))
    const dialog = await screen.findByRole('dialog', { name: 'Запросить коммерческое предложение' })
    expect(within(dialog).getByText('ООО «Морос»', { exact: false })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отправить запрос' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(await within(footer()).findByText(/^КП запрошено · /u)).toBeInTheDocument()
    expect(within(footer()).queryByRole('button', { name: 'Запросить КП' })).not.toBeInTheDocument()
  })

  it('сохранённая оценка PJ-01: числа снимка, как в A1, без выбора сценария и сохранения', async () => {
    renderAt('/projects/PJ-01/economics?as=user')
    const card = await recommendation()
    expect(tiles(card).join(' ')).toMatch(/6,1\sмлн.*42,0\sмлн.*9,2\sмлн.*0,7\sгода/su)
    expect(within(footer()).getByText(/Оценка сохранена 15\.09\.2026/u)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Сохранить оценку' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Выбрать этот сценарий' })).not.toBeInTheDocument()
  })

  it('гость: выбор сценария без сохранения в кабинет и КП, выгрузки и «Войти и сохранить» (ролевая модель, §5)', async () => {
    const services = renderAt('/projects/PJ-DEMO/economics?as=guest')
    await recommendation()
    expect(within(footer()).getByText('Результат виден, сохранение — после входа. Выгрузки доступны')).toBeInTheDocument()
    expect(within(footer()).getByRole('link', { name: 'Войти и сохранить' })).toHaveAttribute('href', '/login')
    expect(within(footer()).getByRole('button', { name: 'Таблицы CSV' })).toBeEnabled()
    expect(within(footer()).queryByRole('button', { name: 'Сохранить оценку' })).not.toBeInTheDocument()
    expect(within(footer()).queryByRole('button', { name: 'Запросить КП' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать этот сценарий' }))
    expect(await screen.findByRole('columnheader', { name: 'Покупка · Выбран' })).toBeInTheDocument()
    // Выбор гостя — в решениях демо-проекта (в API — в браузере до закрытия вкладки).
    await waitFor(async () => { expect((await services.projects.getProject('PJ-DEMO')).inputs.economics?.scenario).toBe('purchase') })
  })

  it('«Как мы к этому пришли»: три шага со ссылками, строка прогона из фикстуры', async () => {
    renderAt('/projects/PJ-DEMO/economics?as=user')
    const path = await screen.findByRole('region', { name: 'Как мы к этому пришли' })
    expect(within(path).getByRole('link', { name: 'Открыть подбор' })).toHaveAttribute('href', '/projects/PJ-DEMO/matching')
    expect(within(path).getByText(/Прогон SIM-0926-01: в пик 130 из 130/u)).toBeInTheDocument()
  })
})
