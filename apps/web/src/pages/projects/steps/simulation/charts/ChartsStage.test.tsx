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

describe('Вкладка «Графики и 2D-сравнение» (07a, PRD 11.4, D-105)', () => {
  it('можно уменьшить: переключатель составов, таблица по часам, время роботов по обоим составам', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    const load = await screen.findByRole('region', { name: 'Загрузка по часам' }, LOAD)
    expect(within(load).getByRole('radio', { name: 'С уменьшением · 16/5' })).toHaveAttribute('aria-checked', 'true')
    expect(within(load).getByRole('img', { name: /^Загрузка по часам · С уменьшением: 16\sроботов, 5\sстанций$/u })).toBeInTheDocument()
    const table = within(card('Что происходило по часам')).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(9)
    expect(within(table).getByRole('rowheader', { name: 'Роботы заняты работой, %' })).toBeInTheDocument()

    fireEvent.click(within(load).getByRole('radio', { name: 'Из подбора · 18/6' }))
    expect(within(load).getByRole('img', { name: /^Загрузка по часам · Из подбора: 18\sроботов, 6\sстанций$/u })).toBeInTheDocument()

    const time = card('На что уходит время робота')
    // Подпись полосы и строка скрытой таблицы с теми же долями.
    expect(within(time).getAllByText(/^Из подбора: 18\sроботов, 6\sстанций — в рейсе \d+\s% времени$/u)).toHaveLength(2)
    expect(within(time).getAllByText(/^С уменьшением: 16\sроботов, 5\sстанций — в рейсе \d+\s% времени$/u)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Принять план и к экономике' })).toBeEnabled()
  })

  it('два плеера с общим временем: старт — первый пиковый час на паузе, «Пуск», «Сначала», скорости', async () => {
    renderTab(await servicesWith('can_reduce', [trace(18, 6), trace(16, 5)]))
    const player = await screen.findByRole('region', { name: 'Воспроизведение дня · 2D' }, LOAD)
    expect(await within(player).findByRole('img', { name: /^Из подбора: 18\sроботов, 6\sстанций$/u })).toBeInTheDocument()
    expect(within(player).getByRole('img', { name: /^С уменьшением: 16\sроботов, 5\sстанций$/u })).toBeInTheDocument()
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('08:00')
    expect(within(player).getByText('пиковый час')).toBeInTheDocument()
    expect(within(player).getAllByText('Роботов в работе')).toHaveLength(2)
    expect(['×120', '×600', '×1800'].map((name) => within(player).getByRole('radio', { name }).getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])

    fireEvent.click(within(player).getByRole('button', { name: 'Пуск' }))
    expect(within(player).getByRole('button', { name: 'Пауза' })).toBeInTheDocument()
    fireEvent.click(within(player).getByRole('button', { name: 'Пауза' }))
    fireEvent.click(within(player).getByRole('button', { name: 'Сначала' }))
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('07:00')
    fireEvent.keyDown(within(player).getByRole('slider', { name: 'Время дня' }), { key: 'End' })
    expect(within(player).getByRole('timer', { name: 'Время дня' })).toHaveTextContent('06:00')
  })

  it('подтверждено: один состав — без переключателя, один плеер', async () => {
    renderTab(await servicesWith('confirmed', [trace(18, 6)]))
    const player = await screen.findByRole('region', { name: 'Воспроизведение дня · 2D' }, LOAD)
    expect(await within(player).findAllByRole('img')).toHaveLength(1)
    expect(within(card('Загрузка по часам')).queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('нужно докупить: у проверенного состава часы с нарушением отмечены плашкой и словом', async () => {
    renderTab(await servicesWith('need_more', []))
    const load = await screen.findByRole('region', { name: 'Загрузка по часам' }, LOAD)
    fireEvent.click(within(load).getByRole('radio', { name: 'Проверено · 15/6' }))
    expect(within(card('Что происходило по часам')).getAllByText(/нарушение/).length).toBeGreaterThan(0)
    expect(await screen.findByText('2D-запись для этого прогона недоступна')).toBeInTheDocument()
  })
})
