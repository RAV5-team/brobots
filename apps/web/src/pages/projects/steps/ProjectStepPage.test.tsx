import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectStep } from '@/domain'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { EconomicsStep } from './economics/EconomicsStep'
import { MatchingStep } from './matching/MatchingStep'
import { ParamsStep } from './params/ParamsStep'
import { ProjectStepPage } from './ProjectStepPage'
import { SimulationStep } from './simulation/SimulationStep'
import type { ProjectStepComponent } from './stepProps'

function WhereAmI() {
  const { pathname } = useLocation()
  return <p data-testid="location">{pathname}</p>
}

const STEPS: Readonly<Record<ProjectStep, ProjectStepComponent>> = {
  params: ParamsStep,
  matching: MatchingStep,
  simulation: SimulationStep,
  economics: EconomicsStep,
}

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            {(Object.entries(STEPS) as [ProjectStep, ProjectStepComponent][]).map(([step, Step]) => (
              <Route key={step} path={`/projects/:projectId/${step}`} element={<><ProjectStepPage step={step} Step={Step} /><WhereAmI /></>} />
            ))}
            <Route path="*" element={<WhereAmI />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

afterEach(() => { sessionStorage.clear() })

describe('ProjectStepPage — каркас шага проекта', () => {
  it('открывает шаг демо-проекта: заголовок шага, крошки с локацией, степпер', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Подбор решения под процесс' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'РЦ Химки' })).toHaveAttribute('href', '/locations/LOC-01')
    expect(screen.getByRole('navigation', { name: 'Шаги проекта' })).toBeInTheDocument()
    expect(document.title).toBe('Подбор решения · Демо-проект · РЦ Химки · RAV5')
  })

  it('закрытый шаг черновика — перенаправление на шаг, где остановились', async () => {
    renderAt('/projects/PJ-02/simulation?as=user')
    await waitFor(() => { expect(screen.getByTestId('location')).toHaveTextContent('/projects/PJ-02/params') })
  })

  it('открытый шаг запоминается: черновик дальше не откатывается, а новый шаг открывается', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const openStep = vi.spyOn(services.projects, 'openStep')
    renderAt('/projects/PJ-04/params?as=user', services)
    await screen.findByRole('heading', { level: 1, name: 'Параметры проекта' })
    expect(openStep).toHaveBeenCalledWith('PJ-04', 'params')
    expect(await services.projects.getProject('PJ-04')).toMatchObject({ status: 'draft', step: 'matching' })
  })

  it('сохранённая оценка — любой шаг, только просмотр (D-17)', async () => {
    renderAt('/projects/PJ-01/params?as=user')
    expect(await screen.findByText('Оценка готова · только просмотр')).toBeInTheDocument()
  })

  it('гостю шаги открыты, с демо-плашкой (D-14, D-82)', async () => {
    renderAt('/projects/PJ-DEMO/params?as=guest')
    expect(await screen.findByRole('heading', { level: 1, name: 'Параметры проекта' })).toBeInTheDocument()
    expect(screen.getByText('Демо-режим · изменения не сохраняются')).toBeInTheDocument()
  })

  it('неизвестный проект — «не найден» со ссылкой к списку', async () => {
    renderAt('/projects/PJ-99/params?as=user')
    expect(await screen.findByRole('heading', { name: 'Проект не найден' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К списку проектов' })).toHaveAttribute('href', '/projects')
  })

  it('ошибка загрузки — «Повторить» загружает снова', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const getProject = vi.spyOn(services.projects, 'getProject').mockRejectedValueOnce(new Error('сеть'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderAt('/projects/PJ-DEMO/params?as=user', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Параметры проекта' })).toBeInTheDocument()
    expect(getProject).toHaveBeenCalledTimes(2)
  })
})
