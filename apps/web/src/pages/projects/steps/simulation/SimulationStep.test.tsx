import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { createSimulationRuns } from '@/services/simulationRuns'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { SimulationStep } from './SimulationStep'

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/simulation" element={<><ProjectStepPage step="simulation" Step={SimulationStep} /><Search /></>} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const stages = () => screen.getByRole('navigation', { name: 'Этапы симуляции' })
const robots = () => screen.getByRole('textbox', { name: 'Роботов' })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 3 «Симуляция», этап 1 «Что проверяется» (3.1 доски, 16325:149; PRD 11.4)', () => {
  it('вариант из подбора, поля состава, расчёт подбора, 4 правила в колонке', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope')
    expect(await screen.findByRole('heading', { level: 1, name: 'Проверка решения из подбора' })).toBeInTheDocument()
    expect(within(stages()).getByText('1. Что проверяется').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
    expect(within(stages()).getByText('3. Моделирование')).toBeInTheDocument()
    const source = await screen.findByRole('region', { name: 'AMR 800 · RaaS' })
    expect(within(source).getByRole('textbox', { name: 'CAPEX' })).toHaveValue('6,1')
    expect(screen.getByLabelText('Допущения расчёта подбора')).toHaveTextContent('130 паллет/ч')
    const checks = screen.getByRole('region', { name: 'Что проверит симуляция' })
    expect(within(checks).getAllByRole('listitem')).toHaveLength(4)
    expect(checks).toHaveTextContent(/не меньше 90\s%\sпотребности \(допуск 10\s%\)/u)
    expect(robots()).toHaveValue('18')
    expect(screen.getByRole('textbox', { name: 'Станций' })).toHaveValue('6')
    expect(screen.queryByRole('link', { name: /К подбору/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Предварительная оценка/)).toBeInTheDocument()
  })

  it('изменённый состав сохраняется в черновик (D-21), возврат к подбору — null', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope', services)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Роботов' }), { target: { value: '17' } })
    expect(update).toHaveBeenCalledWith('PJ-DEMO', { simulation: { fleet: { robots: 17, stations: 6 } } })
    expect(await screen.findByText(/^Черновик сохранён · \d{2}:\d{2}$/)).toHaveAttribute('role', 'status')
    expect(screen.getByText(/было 18 · из подбора/)).toBeInTheDocument()
    fireEvent.change(robots(), { target: { value: '18' } })
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { fleet: null } })
  })

  it('неверное число остаётся в поле с текстом исправления и не сохраняется', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=scope', services)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Станций' }), { target: { value: '0' } })
    expect(screen.getByText('Введите целое число от 1 до 50')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Станций' })).toHaveAttribute('aria-invalid', 'true')
    expect(update).not.toHaveBeenCalled()
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
    fireEvent.change(await screen.findByRole('textbox', { name: 'Роботов' }), { target: { value: '19' } })
    fireEvent.blur(robots())
    expect(robots()).toHaveValue('19')
    expect(update).not.toHaveBeenCalled()
    // Статус сохранения у гостя заменяет демо-плашка каркаса.
    expect(screen.getByText('Демо-режим · изменения не сохраняются')).toBeInTheDocument()
  })

  it('сохранённая оценка — только просмотр (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=scope')
    expect(await screen.findByRole('textbox', { name: 'Роботов' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Станций' })).toBeDisabled()
    expect(screen.getByText('Оценка готова · только просмотр')).toBeInTheDocument()
  })
})

describe('Шаг 3 «Симуляция», этап 2 «Условия симуляции» (3.2 доски, 16325:158; PRD 11.4, D-102)', () => {
  const field = (name: string) => screen.getByRole('textbox', { name })

  it('три карточки по источнику, подразделы, метка — только где источник другой, график в колонке', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions')
    expect(await screen.findByRole('heading', { level: 2, name: 'Из задачи' })).toBeInTheDocument()
    for (const title of ['Значения по умолчанию', 'Допущения расчёта']) expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    for (const title of ['Расписание', 'Потоки', 'Требование к сервису', 'Запас на рост', 'Условия склада', 'Проверка']) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
    expect(await screen.findByRole('textbox', { name: 'Смен в сутки' })).toHaveValue('2')
    expect(field('Длительность смены')).toHaveValue('11')
    expect(field('Приёмка, паллет в сутки')).toHaveValue('1\u00a0000')
    expect(field('Остаётся вручную')).toHaveValue('5')
    expect(field('Коэффициент замещения, платформа')).toHaveValue('0,6')
    const schedule = screen.getByRole('region', { name: 'Расписание' })
    // Смен и длительность — из задачи, как карточка: без метки; начало смены — по умолчанию, коэффициент — допущение.
    expect(within(schedule).queryByText('из задачи')).not.toBeInTheDocument()
    expect(within(schedule).getByText('по умолчанию')).toBeInTheDocument()
    expect(within(schedule).getByText('допущение')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Значения по умолчанию' })).queryByText('по умолчанию')).not.toBeInTheDocument()
    expect(screen.getByText(/^95\s%\s— 19 паллет из 20 укладываются в срок в каждый смоделированный день$/u)).toBeInTheDocument()
    const demand = screen.getByRole('region', { name: 'Потребность по часам' })
    expect(demand).toHaveTextContent(/Подбор рассчитан на130\sрейсов в пиковый час/u)
    expect(demand).toHaveTextContent(/Самый тяжёлый час в сценарии130\sрейсов/u)
    expect(screen.getByRole('table', { name: /Потребность по часам/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument()
  })

  it('правка условия сохраняется, метка — «указано», прошлый прогон устарел (D-89)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    expect(await screen.findByRole('textbox', { name: 'Запас на рост объёма' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Условия изменились — прогон устарел' })).not.toBeInTheDocument()
    fireEvent.change(field('Запас на рост объёма'), { target: { value: '20' } })
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

  it('пиковые окна: отгрузка в те же часы, добавить окно, «Вернуть как в расчёте» (D-102)', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=conditions')
    const inbound = await screen.findByRole('list', { name: 'Приёмка' })
    const outbound = screen.getByRole('list', { name: 'Отгрузка' })
    // Пики расчёта 07–10 и 17–19 — два окна; отгрузка повторяет приёмку и заблокирована.
    expect(within(inbound).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'Отгрузка в те же часы, что приёмка' })).toBeChecked()
    expect(within(outbound).getAllByRole('combobox')[0]).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Вернуть как в расчёте' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить окно' }))
    // Новое окно стоит за последним и не сливается с ним.
    expect(within(inbound).getAllByRole('listitem')).toHaveLength(3)
    expect(within(outbound).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть как в расчёте' }))
    expect(within(inbound).getAllByRole('listitem')).toHaveLength(2)
  })

  it('снятый флажок открывает окна отгрузки и её «Добавить окно»', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=conditions')
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Отгрузка в те же часы, что приёмка' }))
    const outbound = screen.getByRole('list', { name: 'Отгрузка' })
    expect(within(outbound).getAllByRole('combobox')[0]).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Добавить окно' })).toHaveLength(2)
  })

  it('«Запустить симуляцию» открывает этап «Прогон»', async () => {
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions')
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    await waitFor(() => { expect(screen.getByTestId('search')).toHaveTextContent('stage=run') })
  })

  it('сохранённая оценка — поля и окна только для чтения (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=conditions')
    expect(await screen.findByRole('textbox', { name: 'Смен в сутки' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Запустить симуляцию' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Добавить окно' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Приёмка' })).queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('Шаг 3 «Симуляция», этап 3 «Моделирование» (3.3 доски, 16325:167; PRD 11.4, D-103)', () => {
  /** Опрос раз в 5 мс вместо секунды: прогон мока — пять опросов. */
  const fastServices = (): Services => {
    const base = createMockServices({ latencyMs: 0 })
    return { ...base, simulationRuns: createSimulationRuns(base.projects, { pollMs: 5 }) }
  }
  const runCard = () => screen.getByRole('region', { name: /Симуляция выполняется|Прогон завершён/ })

  it('запуск: aria-busy и строка состояния, по завершении — итог, «Смотреть вердикт», прогон в черновике', async () => {
    const services = fastServices()
    const start = vi.spyOn(services.projects, 'startSimulation')
    renderAt('/projects/PJ-DEMO/simulation?as=user&stage=conditions', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Запустить симуляцию' }))
    expect(start).toHaveBeenCalledWith('PJ-DEMO', { fleet: { robots: 18, stations: 6 }, conditions: {} })
    expect(await screen.findByRole('heading', { level: 1, name: 'Моделирование рабочих суток' })).toBeInTheDocument()
    expect(within(stages()).getByText('3. Моделирование').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
    expect(runCard()).toHaveAttribute('aria-busy', 'true')
    expect(runCard()).toHaveTextContent(/Конфигурация из подбора, как в расчёте: 18\sроботов, 6\sстанций — моделируется · Варианты с большим и меньшим парком — в очереди/u)
    expect(document.querySelector('[data-run-status]')).toHaveAttribute('data-run-status', 'running')
    expect(screen.getByRole('progressbar', { name: 'Время прогона из 60 с' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Остановить' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Прогон завершён' }, { timeout: 2_000 })).toBeInTheDocument()
    expect(runCard()).toHaveAttribute('aria-busy', 'false')
    expect(runCard()).toHaveTextContent(/— проверена · Вердикт готов/)
    expect(document.querySelector('[data-run-status]')).toHaveAttribute('data-run-status', 'done')
    expect(screen.getByText(/Вердикт — по худшему смоделированному дню/)).toBeInTheDocument()
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
    await screen.findByRole('heading', { name: 'Симуляция выполняется' })
    first.unmount()
    renderAt('/projects/PJ-DEMO/simulation?as=user', services)
    expect(await screen.findByRole('heading', { name: 'Симуляция выполняется' })).toBeInTheDocument()
    // Этап закреплён в адресе: по завершении остаётся итог прогона, а не вердикт из черновика.
    await waitFor(() => { expect(screen.getByTestId('search')).toHaveTextContent('stage=run') })
    expect(document.querySelector('[data-run-status]')).toHaveAttribute('data-run-status', 'running')
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
    fireEvent.change(await screen.findByRole('textbox', { name: 'Роботов' }), { target: { value: '15' } })
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
