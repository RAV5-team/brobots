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
const plan = (name: RegExp = /^(Что докупить|Состав парка)$/) => screen.getByRole('region', { name })

afterEach(() => { sessionStorage.clear() })

describe('Этап 4 «Вердикт» (3.4 need_more, 16325:176; 3.6 confirmed, 16325:194; PRD 11.4, D-104)', () => {
  it('можно уменьшить: светлая карточка, «Узкое место», состав с чипами, экономика с OPEX и процентами', async () => {
    renderAt(USER, await servicesWith('can_reduce'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Можно уменьшить до 16 роботов и 5 станций' })).toBeInTheDocument()
    expect(screen.getByText('Оценка по худшему из смоделированных дней')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Узкое место' })).toHaveTextContent('17:00')
    expect(screen.queryByText(/обновлено по 2D-модели/)).not.toBeInTheDocument()
    expect(robots()).toHaveAttribute('aria-valuenow', '16')
    expect(within(plan(/^Состав парка$/)).getByText('−2')).toBeInTheDocument()
    expect(within(plan()).getByText(/Состав подтверждён симуляцией/)).toBeInTheDocument()
    const economics = screen.getByRole('table', { name: 'Предварительная экономика по составу плана' })
    expect(within(economics).getByRole('row', { name: /Вложения \(CAPEX\)/ })).toHaveTextContent(/6,1\sмлн\s₽/u)
    expect(within(economics).getByRole('row', { name: /OPEX роботов в год/ })).toHaveTextContent(/−\d+\s%/u)
    expect(screen.getByRole('button', { name: 'Учесть и перейти к экономике' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Изменить условия симуляции' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Выбрать другое решение' })).toHaveAttribute('href', '/projects/PJ-DEMO/matching')
  })

  it('подтверждено (3.6): «Состав парка», оба «без изменений», лаймовая плашка подтверждения', async () => {
    renderAt(USER, await servicesWith('confirmed'))
    expect(await screen.findByRole('region', { name: 'Состав парка' })).toBeInTheDocument()
    expect(within(plan()).getAllByText('без изменений')).toHaveLength(2)
    expect(within(plan()).getByRole('status')).toHaveTextContent(/Состав подтверждён симуляцией: 130 из 130 рейсов в пик, в срок 98,4\s% в худший день/u)
  })

  it('«Уточнить методику»: поправки прогона, выбор сохраняется и не делает прогон устаревшим (D-89)', async () => {
    const services = await servicesWith('confirmed')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt(USER, services)
    const calibration = await screen.findByRole('region', { name: 'Уточнить методику по данным симуляции' })
    expect(within(calibration).getByText('необязательно')).toBeInTheDocument()
    const route = within(calibration).getByRole('checkbox', { name: 'Длина рейса в одну сторону, м' })
    expect(route).not.toBeChecked()
    expect(within(calibration).getByRole('row', { name: /Длина рейса/ })).toHaveTextContent(/100\s*86/)
    fireEvent.click(route)
    expect(route).toBeChecked()
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { calibration: ['route_len_m'] } })
    expect(screen.queryByText(/прогон устарел/)).not.toBeInTheDocument()
  })

  it('«Учесть и перейти к экономике» записывает план и открывает итог и экономику', async () => {
    const services = await servicesWith('can_reduce')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt(USER, services)
    fireEvent.click(await screen.findByRole('button', { name: 'Учесть и перейти к экономике' }))
    expect(await screen.findByText('итог и экономика')).toBeInTheDocument()
    expect(update).toHaveBeenLastCalledWith('PJ-DEMO', { simulation: { plan: null, acceptRisk: false } })
  })

  it('свой состав (07c): не проверен — «Проверить состав прогоном» запускает прогон с ним', async () => {
    const services = await servicesWith('confirmed')
    const start = vi.spyOn(services.projects, 'startSimulation')
    renderAt(USER, services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(within(plan()).getByText(/Состав 19 \/ 6 симуляцией не проверялся/)).toBeInTheDocument()
    expect(within(plan()).getByText('+1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Проверить состав прогоном' }))
    expect(start).toHaveBeenCalledWith('PJ-DEMO', expect.objectContaining({ fleet: { robots: 19, stations: 6 } }))
    await waitFor(() => { expect(screen.getByTestId('search')).toHaveTextContent('stage=run') })
  })

  it('нужно докупить (3.4, 07b): «Что докупить», проверено и рекомендация, риск — кнопка «с риском»', async () => {
    const services = await servicesWith('need_more')
    renderAt(USER, services)
    expect(await screen.findByRole('heading', { level: 2, name: /докупить \+3 робота/ })).toBeInTheDocument()
    const card = plan(/^Что докупить$/)
    expect(within(card).getByText('+3')).toBeInTheDocument()
    expect(within(card).getByText('проверено: 15')).toBeInTheDocument()
    expect(within(card).getByText(/рекомендация: 18/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Продолжить без изменений (15 / 6) и принять риск' }))
    expect(robots()).toHaveAttribute('aria-valuenow', '15')
    expect(robots()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/В пик вывозится 93,8\s% потребности/u)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к экономике с 15 / 6 — с риском' }))
    expect(await screen.findByText('итог и экономика')).toBeInTheDocument()
  })

  it.each(['layout_bottleneck', 'unreachable'] as const)('%s: без состава и экономики, только другие условия или решение', async (verdict) => {
    renderAt(USER, await servicesWith(verdict))
    expect(await screen.findByText(/Переход к экономике закрыт/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Что докупить|Состав парка/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Уточнить методику по данным симуляции' })).not.toBeInTheDocument()
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

  it('гость меняет план демо-проекта: решение идёт в сессию, не в кабинет (ролевая модель, §5)', async () => {
    const services = await servicesWith('can_reduce')
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/simulation?as=guest&stage=verdict', services)
    fireEvent.keyDown(await screen.findByRole('spinbutton', { name: 'Роботов' }), { key: 'ArrowUp' })
    expect(robots()).toHaveAttribute('aria-valuenow', '17')
    await waitFor(() => { expect(update).toHaveBeenCalled() })
  })

  it('сохранённая оценка — план только для просмотра, переход «К итогу и экономике» (D-17)', async () => {
    renderAt('/projects/PJ-01/simulation?as=user&stage=verdict', createMockServices({ latencyMs: 0 }))
    expect(await screen.findByRole('spinbutton', { name: 'Роботов' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'К итогу и экономике' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Вернуть как в подборе' })).not.toBeInTheDocument()
  })
})
