import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { ParamsStep } from './ParamsStep'

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/params" element={<ProjectStepPage step="params" Step={ParamsStep} />} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const matchButton = () => screen.getByRole('button', { name: 'Подобрать решения' })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 1 «Параметры проекта» (экран 02, PRD 11.2)', () => {
  it('демо-проект: три блока, выбран процесс проекта, решение из каталога, подбор выполним', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user')
    expect(await screen.findByRole('heading', { name: '1. Выбор процесса' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2. Условия площадки' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3. Допущения расчёта' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Перемещение паллет' })).toBeChecked()
    expect(screen.getByRole('heading', { name: 'AMR 800' })).toBeInTheDocument()
    expect(matchButton()).toBeEnabled()
  })

  it('инвентаризация PJ-07: подбор недоступен, понятная причина и что заполнить', async () => {
    renderAt('/projects/PJ-07/params?as=user')
    await screen.findByRole('heading', { name: '1. Выбор процесса' })
    expect(matchButton()).toBeDisabled()
    const readiness = screen.getByRole('region', { name: 'Подбор недоступен' })
    expect(within(readiness).getByText(/Не хватает данных: частота пересчёта\. Технический подбор недоступен/)).toBeInTheDocument()
    expect(within(readiness).getByRole('link', { name: 'Частота пересчёта' })).toHaveAttribute('href', '/locations/LOC-01/processes/LP-05')
    expect(within(readiness).getByRole('link', { name: 'Нагрузка на пол' })).toHaveAttribute('href', '/locations/LOC-01/params#site_floor_load_tm2')
  })

  it('пользователь: смена процесса сохраняется в черновик (D-21, D-94)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const selectProcess = vi.spyOn(services.projects, 'selectProcess')
    renderAt('/projects/PJ-07/params?as=user', services)
    fireEvent.click(await screen.findByRole('radio', { name: 'Перемещение паллет' }))
    expect(selectProcess).toHaveBeenCalledWith('PJ-07', 'LP-01')
    expect(await screen.findByText(/Черновик сохранён/)).toBeInTheDocument()
    expect(matchButton()).toBeEnabled()
  })

  it('гость: выбор и уточнения работают на странице, но не сохраняются (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const selectProcess = vi.spyOn(services.projects, 'selectProcess')
    const updateInputs = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/params?as=guest', services)
    fireEvent.click(await screen.findByRole('radio', { name: 'Упаковка' }))
    expect(screen.getByRole('radio', { name: 'Упаковка' })).toBeChecked()
    expect(screen.getByText('Изменения видны только вам и не сохраняются')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Уточнить значение: Пиковый коэффициент' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '1,8' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(screen.getByText(/Пиковый коэффициент — 1,8/)).toBeInTheDocument()
    expect(selectProcess).not.toHaveBeenCalled()
    expect(updateInputs).not.toHaveBeenCalled()
  })

  it('панель «Уточнить допущение»: значение вне диапазона — текст исправления, окно не закрывается', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Уточнить значение: Средняя длина маршрута' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '9000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }))
    expect(await within(dialog).findByText(/Введите значение от 5 до 5.000 м/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('сохранённая оценка: процесс не меняется, «Уточнить» нет (D-17)', async () => {
    renderAt('/projects/PJ-01/params?as=user')
    await screen.findByRole('heading', { name: '3. Допущения расчёта' })
    expect(screen.getByRole('radio', { name: 'Перемещение паллет' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Уточнить значение/ })).not.toBeInTheDocument()
  })
})
