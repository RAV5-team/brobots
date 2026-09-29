import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SimulationTrace, SimulationVerdict } from '@/domain'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../../ProjectStepPage'
import { SimulationStep } from '../SimulationStep'

const RUNS: Partial<Record<SimulationVerdict, string>> = { confirmed: 'SIM-0926-01', can_reduce: 'SIM-0926-02', need_more: 'SIM-0926-03' }
const LOAD = { timeout: 5_000 }

/** Маленькая трасса вместо файлов по 1,7 МБ: настоящие проверяет mocks/fixtures/traces.test.ts. Запись — с 07:00, 23 ч. */
const trace = (robots: number, chargers: number): SimulationTrace => ({
  name: `${String(robots)}/${String(chargers)}`, stepS: 900, robots, chargers, clockOffsetH: 7, states: ['idle', 'to_drop', 'wait_charger'],
  layout: {
    nodes: [{ id: 'D0', x: 0, y: -6, type: 'dock_in' }, { id: 'D1', x: 40, y: -6, type: 'dock_out' }, { id: 'J1', x: 10, y: 100, type: 'junction' }],
    edges: [{ from: 'D0', to: 'J1', kind: 'main' }],
    chargerSlots: [[75, -3]],
    width: 70,
    depth: 140,
  },
  frames: Array.from({ length: 93 }, (_, i) => ({ t: i * 900, robots: Array.from({ length: robots }, (_, r) => [r, i, r % 3] as const) })),
})

async function servicesWith(verdict: SimulationVerdict, traces: readonly SimulationTrace[]): Promise<Services> {
  const services = createMockServices({ latencyMs: 0 })
  const run = await services.projects.getSimulationRun(RUNS[verdict] ?? '')
  await services.projects.updateInputs('PJ-DEMO', { simulation: { stage: 'verdict', fleet: run.from, runId: run.id } })
  vi.spyOn(services.projects, 'getSimulationTraces').mockResolvedValue(traces)
  return services
}

const renderTab = (services: Services) =>
  render(
    <MemoryRouter initialEntries={['/projects/PJ-DEMO/simulation?as=user&stage=verdict&tab=charts']}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/simulation" element={<ProjectStepPage step="simulation" Step={SimulationStep} />} />
            <Route path="/projects/:projectId/economics" element={<p>итог и экономика</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const card = (name: string) => screen.getByRole('region', { name })

afterEach(() => { sessionStorage.clear() })

describe('Вкладка «Графики и 2D-сравнение» (3.5 · облегчённый, 17040:10; PRD 11.4, D-105)', () => {
  it('можно уменьшить: оба состава без переключателя, итог в пик в легенде, часы от начала смены', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    expect(await screen.findByRole('heading', { level: 1, name: 'Вердикт по составу парка' }, LOAD)).toBeInTheDocument()
    const load = await screen.findByRole('region', { name: 'Загрузка по часам' }, LOAD)
    expect(within(load).queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(within(load).getByText('Оба состава, текущий объём')).toBeInTheDocument()
    // Легенда: оба состава с итогом в пик — «вывод первым».
    // Подпись состава — в легенде и в заголовке колонки скрытой таблицы графика.
    expect(within(load).getAllByText('Из подбора · 18/6').length).toBeGreaterThan(0)
    expect(within(load).getAllByText('С изменениями · 16/5').length).toBeGreaterThan(0)
    expect(within(load).getAllByText(/^в пик \d+ из 130 рейсов$/)).toHaveLength(2)
    const table = within(load).getByRole('table', { name: 'Что происходило по часам' })
    expect(within(table).getAllByRole('columnheader')[1]).toHaveTextContent('07')
    expect(screen.queryByRole('button', { name: /Принять план|Учесть и перейти/ })).not.toBeInTheDocument()
  })

  it('таблица по часам: группы, строки по составам, по умолчанию — только различия; «Показать все строки»', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    const load = await screen.findByRole('region', { name: 'Загрузка по часам' }, LOAD)
    const table = within(load).getByRole('table', { name: 'Что происходило по часам' })
    expect(within(table).getByText('Нагрузка на парк')).toBeInTheDocument()
    expect(within(table).getByText('Результат')).toBeInTheDocument()
    expect(table).toHaveTextContent(/требование — от 95\s%/u)
    expect(within(table).getAllByRole('rowheader', { name: /: С изменениями$/ }).length).toBeGreaterThan(0)
    const shown = within(table).getAllByRole('row').length
    const toggle = within(load).queryByRole('button', { name: /^Показать все строки · \d+$/ })
    if (toggle) {
      fireEvent.click(toggle)
      expect(within(within(load).getByRole('table', { name: 'Что происходило по часам' })).getAllByRole('row').length).toBeGreaterThan(shown)
      expect(within(load).getByRole('button', { name: 'Только различия' })).toBeInTheDocument()
    }
  })

  it('время роботов: «Куда уходит время роботов», подписи «Из подбора» и «С изменениями»', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    const time = await screen.findByRole('region', { name: 'Куда уходит время роботов' }, LOAD)
    expect(within(time).getAllByText(/^Из подбора: 18\sроботов, 6\sстанций — в рейсе \d+\s% времени$/u).length).toBeGreaterThan(0)
    expect(within(time).getAllByText(/^С изменениями: 16\sроботов, 5\sстанций — в рейсе \d+\s% времени$/u).length).toBeGreaterThan(0)
  })

  it('два плеера: пауза в начале пика, иконки «Пуск» и «Сначала», скорость «Сутки за 2 мин 24 с», готовность по атрибуту', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    const player = await screen.findByRole('region', { name: '2D-сравнение: один и тот же смоделированный день' }, LOAD)
    expect(await within(player).findByRole('img', { name: 'Из подбора: 18/6' })).toBeInTheDocument()
    expect(within(player).getByText('Слева состав из подбора, справа — с изменениями; время общее')).toBeInTheDocument()
    expect(player).toHaveAttribute('data-players', 'ready')
    expect(within(player).getByRole('img', { name: 'С изменениями: 16/5' })).toBeInTheDocument()
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('08:00')
    expect(within(player).getByText('пиковый час')).toBeInTheDocument()
    expect(within(player).getAllByText('На схеме в 08:00')).toHaveLength(2)
    expect(within(player).getByRole('combobox', { name: 'Скорость воспроизведения' })).toHaveTextContent('Сутки за 2 мин 24 с')
    // Список «Скорость просмотра» (17083:1232): «Сутки за …» и вторая строка «1 ч суток — за …».
    fireEvent.click(within(player).getByRole('combobox', { name: 'Скорость воспроизведения' }))
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Сутки за 12 мин1 ч суток — за 30 с', 'Сутки за 2 мин 24 с1 ч суток — за 6 с', 'Сутки за 48 с1 ч суток — за 2 с'])
    fireEvent.keyDown(options[0] as HTMLElement, { key: 'Escape' })

    fireEvent.click(within(player).getByRole('button', { name: 'Пуск' }))
    fireEvent.click(within(player).getByRole('button', { name: 'Пауза' }))
    fireEvent.click(within(player).getByRole('button', { name: 'Сначала' }))
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('07:00')
    fireEvent.keyDown(within(player).getByRole('slider', { name: 'Время дня' }), { key: 'End' })
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('06:00')
  })

  it('подтверждено: один состав — один плеер, таблица без фильтра различий', async () => {
    renderTab(await servicesWith('confirmed', [trace(18, 6)]))
    const player = await screen.findByRole('region', { name: '2D-сравнение: один и тот же смоделированный день' }, LOAD)
    expect(await within(player).findAllByRole('img')).toHaveLength(1)
    // Сравнивать не с чем: подписи без «слева… справа…» и «оба состава» (PRD 11.4: состав подбора без изменений).
    expect(within(player).getByText('Состав не менялся — плеер воспроизводит записанный прогон')).toBeInTheDocument()
    expect(within(card('Загрузка по часам')).getByText('Один состав, текущий объём')).toBeInTheDocument()
    expect(within(card('Загрузка по часам')).queryByRole('button', { name: /Показать все строки/ })).not.toBeInTheDocument()
  })

  it('нужно докупить: нарушения у проверенного состава отмечены, без трасс — пустое состояние', async () => {
    renderTab(await servicesWith('need_more', []))
    const load = await screen.findByRole('region', { name: 'Загрузка по часам' }, LOAD)
    expect(within(load).getAllByText(/нарушение/).length).toBeGreaterThan(0)
    expect(await screen.findByText('2D-запись для этого прогона недоступна')).toBeInTheDocument()
  })
})
