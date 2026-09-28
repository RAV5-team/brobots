import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SimulationVerdict } from '@/domain'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { SimulationStep } from './SimulationStep'

const RUNS: Readonly<Record<SimulationVerdict, string>> = {
  confirmed: 'SIM-0926-01',
  can_reduce: 'SIM-0926-02',
  need_more: 'SIM-0926-03',
  layout_bottleneck: 'SIM-0926-04',
  unreachable: 'SIM-0926-05',
}

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

/** Демо-проект на этапе «Вердикт» с прогоном нужного вердикта — как сценарии /dev/screens. */
async function servicesWith(verdict: SimulationVerdict): Promise<Services> {
  const services = createMockServices({ latencyMs: 0 })
  const run = await services.projects.getSimulationRun(RUNS[verdict])
  await services.projects.updateInputs('PJ-DEMO', { simulation: { stage: 'verdict', fleet: run.from, runId: run.id } })
  return services
}

const renderAt = (path: string, services: Services) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/simulation" element={<><ProjectStepPage step="simulation" Step={SimulationStep} /><Search /></>} />
            <Route path="/projects/:projectId/economics" element={<p>итог и экономика</p>} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const USER = '/projects/PJ-DEMO/simulation?as=user&stage=verdict'
const robots = () => screen.getByRole('spinbutton', { name: 'Роботов' })
const plan = () => screen.getByRole('region', { name: 'План изменений по итогам прогона' })

afterEach(() => { sessionStorage.clear() })

describe('Этап 4 «Вердикт» (экран 07, PRD 11.4, D-104)', () => {
  it('можно уменьшить: вердикт, рекомендация подставлена, «было» и дельта, экономика было → стало', async () => {
    renderAt(USER, await servicesWith('can_reduce'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Можно уменьшить до 16 роботов и 5 станций' })).toBeInTheDocument()
    expect(screen.getByText('Можно уменьшить · обновлено по 2D-модели')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Где тоньше всего' })).toHaveTextContent('17:00')
    expect(robots()).toHaveAttribute('aria-valuenow', '16')
    expect(within(plan()).getByText(/^Экономия 2\sроботов и 1\sстанции$/u)).toBeInTheDocument()
    expect(within(plan()).getAllByText(/было 18 · из подбора/)).toHaveLength(1)
    expect(within(plan()).getByText(/проверен симуляцией/)).toBeInTheDocument()
    const economics = screen.getByRole('table', { name: 'Предварительная экономика по составу плана' })
    expect(within(economics).getByRole('row', { name: /CAPEX/ })).toHaveTextContent(/6,1\sмлн\s₽/u)
    expect(screen.getByRole('button', { name: 'Принять план и к экономике' })).toBeEnabled()
  })

  it('«Принять план» записывает план и открывает итог и экономику', async () => {
    const services = await servicesWith('can_reduce')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt(USER, services)
    fireEvent.click(await screen.findByRole('button', { name: 'Принять план и к экономике' }))
    expect(await screen.findByText('итог и экономика')).toBeInTheDocument()
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { plan: null, acceptRisk: false } })
  })

  it('свой состав (07c): не проверен — «Проверить состав прогоном» запускает прогон с ним', async () => {
    const services = await servicesWith('confirmed')
    const start = vi.spyOn(services.projects, 'startSimulation')
    renderAt(USER, services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(within(plan()).getByText(/Состав 19 \/ 6 симуляцией не проверялся/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Принять план/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть как в подборе' }))
    expect(robots()).toHaveAttribute('aria-valuenow', '18')
    fireEvent.keyDown(robots(), { key: 'ArrowUp' })
    fireEvent.click(screen.getByRole('button', { name: 'Проверить состав прогоном' }))
    await waitFor(() => { expect(start).toHaveBeenCalledWith('PJ-DEMO', { fleet: { robots: 19, stations: 6 }, conditions: {} }) })
    expect(screen.getByTestId('search')).toHaveTextContent('stage=run')
  })

  it('нужно докупить (07b): прежний состав — только с принятым риском, текст риска и кнопка «с риском»', async () => {
    const services = await servicesWith('need_more')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt(USER, services)
    expect(await screen.findByRole('heading', { level: 2, name: /докупить \+3 робота/ })).toBeInTheDocument()
    expect(robots()).toHaveAttribute('aria-valuenow', '18')
    expect(within(plan()).getByText(/было 15 · проверено/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Продолжить без изменений (15 / 6) и принять риск' }))
    expect(robots()).toHaveAttribute('aria-valuenow', '15')
    expect(robots()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/В пик вывозится 93,8\s% потребности/u)).toBeInTheDocument()
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { plan: { robots: 15, stations: 6 }, acceptRisk: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к экономике с 15 / 6 — с риском' }))
    expect(await screen.findByText('итог и экономика')).toBeInTheDocument()
  })

  it.each(['layout_bottleneck', 'unreachable'] as const)('%s: переход к экономике закрыт, плана нет', async (verdict) => {
    renderAt(USER, await servicesWith(verdict))
    expect(await screen.findByText(/Переход к экономике закрыт/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'План изменений по итогам прогона' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Изменить условия симуляции' })).toHaveAttribute('href', expect.stringContaining('stage=conditions'))
    expect(screen.getByRole('link', { name: 'Выбрать другое решение' })).toHaveAttribute('href', '/projects/PJ-DEMO/matching')
  })

  it('вкладка «Графики и 2D-сравнение» — свой адрес (07a, подробно — charts/ChartsStage.test.tsx)', async () => {
    const services = await servicesWith('confirmed')
    vi.spyOn(services.projects, 'getSimulationTraces').mockResolvedValue([])
    renderAt(USER, services)
    fireEvent.click(await screen.findByRole('link', { name: 'Графики и 2D-сравнение' }))
    expect(screen.getByTestId('search')).toHaveTextContent('tab=charts')
    expect(await screen.findByRole('heading', { level: 2, name: 'Загрузка по часам' })).toBeInTheDocument()
  })

  it('гость меняет план только на странице (D-14)', async () => {
    const services = await servicesWith('can_reduce')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=verdict', services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(robots()).toHaveAttribute('aria-valuenow', '17')
    expect(update).not.toHaveBeenCalled()
  })

  it('сохранённая оценка — план только для просмотра, переход «К итогу и экономике» (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=verdict', createMockServices({ latencyMs: 0 }))
    expect(await screen.findByRole('spinbutton', { name: 'Роботов' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'К итогу и экономике' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Вернуть как в подборе' })).not.toBeInTheDocument()
  })
})
