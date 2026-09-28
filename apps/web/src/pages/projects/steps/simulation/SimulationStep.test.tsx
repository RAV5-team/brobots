import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { createSimulationRuns } from '@/services/simulationRuns'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/simulation" element={<><ProjectStepPage step="simulation" /><Search /></>} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const stages = () => screen.getByRole('navigation', { name: 'Этапы симуляции' })
const robots = () => screen.getByRole('spinbutton', { name: 'Роботов' })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 3 «Симуляция», этап 1 «Что проверяем» (экран 04, PRD 11.4)', () => {
  it('вариант из подбора, допущения, 4 правила и состав как в подборе', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope')
    expect(await screen.findByRole('heading', { level: 1, name: 'Проверяем решение из подбора' })).toBeInTheDocument()
    expect(within(stages()).getByText('1. Что проверяем').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
    const source = await screen.findByRole('region', { name: /^AMR 800 · RaaS · 18\sроботов$/u })
    expect(source).toHaveTextContent('6,1 млн ₽')
    expect(screen.getByLabelText('Допущения расчёта подбора')).toHaveTextContent('130 паллет/ч')
    expect(within(screen.getByRole('region', { name: 'Что проверит симуляция' })).getAllByRole('listitem')).toHaveLength(4)
    expect(robots()).toHaveAttribute('aria-valuenow', '18')
    expect(screen.getByRole('spinbutton', { name: 'Зарядных станций' })).toHaveAttribute('aria-valuenow', '6')
    expect(screen.getByText(/Предварительная оценка/)).toBeInTheDocument()
  })

  it('изменённый состав сохраняется в черновик (D-21), возврат к подбору — null', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope', services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowDown' })
    expect(update).toHaveBeenCalledWith('PJ-DEMO', { simulation: { fleet: { robots: 17, stations: 6 } } })
    expect(await screen.findByText(/Черновик сохранён/)).toBeInTheDocument()
    expect(screen.getByText(/было 18 · из подбора/)).toBeInTheDocument()
    fireEvent.keyDown(robots(), { key: 'ArrowUp' })
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { fleet: null } })
  })

  it('«Задать параметры симуляции» открывает этап 2 (PRD 15 · №86)', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope')
    fireEvent.click(await screen.findByRole('button', { name: 'Задать параметры симуляции' }))
    expect(screen.getByTestId('search')).toHaveTextContent('stage=conditions')
    expect(await screen.findByRole('heading', { level: 1, name: 'Условия симуляции' })).toBeInTheDocument()
  })

  it('гость меняет состав только на странице (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=scope', services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(robots()).toHaveAttribute('aria-valuenow', '19')
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('Демо-режим: изменения не сохраняются')).toBeInTheDocument()
  })

  it('сохранённая оценка — только просмотр (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=scope')
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(robots()).toHaveAttribute('aria-valuenow', '18')
    expect(screen.getByText('Оценка сохранена — только просмотр')).toBeInTheDocument()
  })
})

describe('Шаг 3 «Симуляция», этап 2 «Условия симуляции» (экран 05, PRD 11.4, D-102)', () => {
  const field = (name: string) => screen.getByRole('textbox', { name })

  it('семь групп, значения из задачи и по умолчанию с метками, сверка с подбором', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions')
    expect(await screen.findByRole('heading', { name: 'Расписание' })).toBeInTheDocument()
    for (const title of ['Расписание', 'Потоки', 'Требование к сервису', 'Запас на рост', 'Условия склада', 'Допущения расчёта', 'Проверка']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(await screen.findByRole('textbox', { name: 'Смен в сутки' })).toHaveValue('2')
    expect(field('Длительность смены')).toHaveValue('11')
    expect(field('Приёмка, паллет в сутки')).toHaveValue('1\u00a0000')
    expect(field('Остаётся вручную')).toHaveValue('5')
    expect(field('Коэффициент замещения, платформа')).toHaveValue('0,6')
    const schedule = screen.getByRole('region', { name: 'Расписание' })
    expect(within(schedule).getAllByText('из задачи')).toHaveLength(2)
    expect(within(schedule).getByText('допущение')).toBeInTheDocument()
    expect(screen.getByText(/Подбор рассчитан на 130 рейсов в пиковый час. Самый тяжёлый час в сценарии — 130 рейсов, запас 0/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /Потребность по часам/ })).toBeInTheDocument()
  })

  it('правка условия сохраняется, метка — «указано», прошлый прогон устарел (D-89)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Запас на рост объёма' }), { target: { value: '20' } })
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { conditions: { growthReserve: 0.2 } } })
    expect(await screen.findByRole('heading', { name: 'Условия изменились — прогон устарел' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Запас на рост' })).getByText('указано')).toBeInTheDocument()
  })

  it('неверное значение — текст исправления, не сохраняется, запуск закрыт', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Доля паллет в срок' }), { target: { value: '20' } })
    expect(screen.getByText('Введите число от 50 до 100')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Запустить симуляцию' })).toBeDisabled()
  })

  it('пиковый час отмечается кликом, «Вернуть как в расчёте» возвращает пики', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=conditions')
    const inbound = await screen.findByRole('group', { name: 'Приёмка' })
    const noon = within(inbound).getByRole('button', { name: 'Приёмка, 12:00–13:00' })
    expect(noon).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(noon)
    expect(noon).toHaveAttribute('aria-pressed', 'true')
    expect(within(inbound).getByRole('button', { name: 'Приёмка, 05:00–06:00' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть как в расчёте' }))
    expect(noon).toHaveAttribute('aria-pressed', 'false')
  })

  it('«Запустить симуляцию» открывает этап «Прогон»', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions')
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    await waitFor(() => { expect(screen.getByTestId('search')).toHaveTextContent('stage=run') })
  })

  it('сохранённая оценка — поля только для чтения (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=conditions')
    expect(await screen.findByRole('textbox', { name: 'Смен в сутки' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Запустить симуляцию' })).toBeDisabled()
  })
})

describe('Шаг 3 «Симуляция», этап 3 «Прогон» (экран 06, PRD 11.4, D-103)', () => {
  /** Опрос раз в 5 мс вместо секунды: прогон мока — пять опросов. */
  const fastServices = (): Services => {
    const base = createMockServices({ latencyMs: 0 })
    return { ...base, simulationRuns: createSimulationRuns(base.projects, { pollMs: 5 }) }
  }
  const runCard = () => screen.getByRole('region', { name: /Симуляция выполняется|Прогон завершён/ })

  it('запуск: aria-busy и журнал строками, по завершении — итог, «Смотреть вердикт», прогон в черновике', async () => {
    const services = fastServices()
    const start = vi.spyOn(services.projects, 'startSimulation')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    expect(start).toHaveBeenCalledWith('PJ-DEMO', { fleet: { robots: 18, stations: 6 }, conditions: {} })
    expect(await screen.findByRole('heading', { level: 1, name: 'Прогоняем рабочие сутки' })).toBeInTheDocument()
    expect(runCard()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('progressbar', { name: 'Время прогона из 60 с' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Остановить' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Прогон завершён' }, { timeout: 2_000 })).toBeInTheDocument()
    expect(runCard()).toHaveAttribute('aria-busy', 'false')
    expect(within(runCard()).getAllByRole('listitem').length).toBeGreaterThan(2)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('link', { name: 'Смотреть вердикт' })).toHaveAttribute('href', expect.stringContaining('stage=verdict'))
    const project = await services.projects.getProject('PJ-DEMO')
    expect(project.inputs.simulation).toMatchObject({ runId: 'SIM-0926-01', stage: 'verdict' })
  })

  it('уход со страницы и возврат не теряют прогон: без ?stage открывается идущий прогон', async () => {
    const services = fastServices()
    // Опрос ждёт, пока страница не откроется снова: прогон точно идёт в момент возврата.
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const poll = services.projects.getSimulationJob.bind(services.projects)
    vi.spyOn(services.projects, 'getSimulationJob').mockImplementation(async (jobId) => {
      const job = await poll(jobId)
      if (job.log.length > 1) await gate
      return job
    })
    const first = renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    await screen.findByText(/Смоделированы сутки/)
    first.unmount()
    renderAt('/projects/PJ-DEMO/simulation?as=user', services)
    expect(await screen.findByRole('heading', { name: 'Симуляция выполняется' })).toBeInTheDocument()
    // Этап закреплён в адресе: по завершении остаётся итог прогона, а не вердикт из черновика.
    await waitFor(() => { expect(screen.getByTestId('search')).toHaveTextContent('stage=run') })
    expect(screen.getByText(/Смоделированы сутки/)).toBeInTheDocument()
    release()
    expect(await screen.findByRole('heading', { name: 'Прогон завершён' }, { timeout: 2_000 })).toBeInTheDocument()
  })

  it('«Остановить» возвращает к условиям, прогон не записывается', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Остановить' }))
    expect(screen.getByTestId('search')).toHaveTextContent('stage=conditions')
    expect(services.simulationRuns.get('PJ-DEMO')).toBeNull()
    expect(update.mock.calls.some(([, patch]) => patch.simulation?.runId !== undefined)).toBe(false)
  })

  it('гость: прогон по составу со страницы, в проект не пишется (D-14)', async () => {
    const services = fastServices()
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=scope', services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowDown' })
    fireEvent.keyDown(robots(), { key: 'ArrowDown' })
    fireEvent.keyDown(robots(), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('button', { name: 'Задать параметры симуляции' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    expect(await screen.findByRole('heading', { name: 'Прогон завершён' }, { timeout: 2_000 })).toBeInTheDocument()
    expect(services.simulationRuns.get('PJ-DEMO')).toMatchObject({ status: 'done', runId: 'SIM-0926-03' })
    expect((await services.projects.getProject('PJ-DEMO')).inputs.simulation?.runId).toBe('SIM-0926-01')
  })

  it('без прогона в сессии: последний прогон и «Запустить заново»; у сохранённой оценки — только вердикт (D-17)', async () => {
    const view = renderAt('/projects/PJ-DEMO/simulation?as=user&stage=run')
    expect(await screen.findByRole('heading', { name: 'Последний прогон · SIM-0926-01' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Запустить заново' })).toBeEnabled()
    view.unmount()
    renderAt('/projects/PJ-01/simulation?as=user&stage=run')
    expect(await screen.findByRole('heading', { name: 'Прогон выполнен · SIM-0926-01' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Запустить заново' })).not.toBeInTheDocument()
  })
})
