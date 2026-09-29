import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { ParamsStep } from './ParamsStep'
import { paramsExpandedState } from './useGroupReveal'

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 }), state: unknown = null) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path.split('?')[0] ?? path, search: path.includes('?') ? `?${path.split('?')[1] ?? ''}` : '', state }]}>
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

describe('Шаг 1 «Параметры проекта» (доска 16325, экран 1.1; PRD 11.2)', () => {
  it('демо-проект: три блока, выбран процесс проекта, группы свёрнуты, подбор выполним', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user')
    expect(await screen.findByRole('heading', { name: '1. Выбор процесса' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2. Локация' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3. Нормативы и допущения расчёта' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Перемещение паллет' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Объём и нагрузка/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'AMR 800' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Уточнить значение/ })).not.toBeInTheDocument()
    expect(matchButton()).toBeEnabled()
  })

  it('rail: готовность над кнопкой, счётчики совпадают с таблицей нормативов', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user')
    const table = await screen.findByRole('table', { name: '3. Нормативы и допущения расчёта' })
    const rows = within(table).getAllByRole('row').slice(1)
    const norms = rows.filter((row) => within(row).queryByText('норматив')).length
    const readiness = screen.getByRole('region', { name: /требуют? проверки/ })
    expect(within(readiness).getByRole('link', { name: `Нормативы: ${String(norms)} — перейти к таблице` })).toHaveAttribute('href', '#params-assumptions')
    expect(within(readiness).getByRole('link', { name: `Допущения: ${String(rows.length - norms)} — перейти к таблице` })).toBeInTheDocument()
    expect(readiness.compareDocumentPosition(matchButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('«↓» в поповере статуса раскрывает группу со значением', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Не хватает данных: Перемещение паллет' }))
    const popover = await screen.findByRole('dialog', { name: /Нет данных для оценки/ })
    expect(within(popover).getByRole('link', { name: 'Уточнить параметры площадки' })).toHaveAttribute('href', '/locations/LOC-01/params')
    fireEvent.click(within(popover).getByRole('button', { name: 'Перейти к значению: нагрузка на пол' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: /Покрытие пола/ })).toHaveAttribute('aria-expanded', 'true') })
  })

  it('инвентаризация PJ-07: подбор недоступен, красный чип и путь в профиль процесса', async () => {
    renderAt('/projects/PJ-07/params?as=user')
    await screen.findByRole('heading', { name: '1. Выбор процесса' })
    expect(matchButton()).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Не хватает данных: частота пересчёта' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Блокирует подбор: Инвентаризация' }))
    const popover = await screen.findByRole('dialog', { name: 'Подбор недоступен: нет частоты пересчёта' })
    expect(within(popover).getByText(/Без частоты пересчёта не посчитать число роботов/)).toBeInTheDocument()
    expect(within(popover).getByRole('link', { name: 'Изменить процесс в профиле' })).toHaveAttribute('href', '/locations/LOC-01/processes/LP-05')
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

  it('гость: выбор работает на странице, но не сохраняется (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const selectProcess = vi.spyOn(services.projects, 'selectProcess')
    renderAt('/projects/PJ-DEMO/params?as=guest', services)
    fireEvent.click(await screen.findByRole('radio', { name: 'Упаковка' }))
    expect(screen.getByRole('radio', { name: 'Упаковка' })).toBeChecked()
    expect(screen.queryByText(/Черновик сохранён/)).not.toBeInTheDocument()
    expect(selectProcess).not.toHaveBeenCalled()
  })

  it('«всё раскрыто» (16992:10): группы, разбор нагрузки и все параметры локации открыты, поповер закрыт', async () => {
    renderAt('/projects/PJ-DEMO/params?as=user', createMockServices({ latencyMs: 0 }), paramsExpandedState())
    await screen.findByRole('heading', { name: '1. Выбор процесса' })
    for (const name of [/Объём и нагрузка/, /Исполнители/, /Покрытие пола/, /Связь и зарядная инфраструктура/]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true')
    }
    expect(screen.getByRole('button', { name: 'Скрыть' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Показать только применимые к процессу' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Раскрытое можно свернуть — как в обычном виде.
    fireEvent.click(screen.getByRole('button', { name: /Покрытие пола/ }))
    expect(screen.getByRole('button', { name: /Покрытие пола/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('упаковка (1.3): свой график в локации, маршрут «не применяется», экономия труда не рассчитается', async () => {
    const services = createMockServices({ latencyMs: 0 })
    await services.projects.selectProcess('PJ-DEMO', 'LP-03')
    renderAt('/projects/PJ-DEMO/params?as=user', services, paramsExpandedState({ siteAll: false, breakdown: false }))
    expect(await screen.findByText(/используется собственный график: 16 ч\/сутки/)).toBeInTheDocument()
    expect(screen.getByText('Не применяется — работа на стационарном посту')).toBeInTheDocument()
    expect(screen.getByText('Оклад не указан')).toBeInTheDocument()
    expect(screen.getByText(/«Требует проверки»\. Экономия труда не рассчитается, пока не указан оклад/)).toBeInTheDocument()
    expect(matchButton()).toBeEnabled()
  })

  it('уборка (1.4): исполнители не привязаны — экономия труда не рассчитается, подбор выполним', async () => {
    const services = createMockServices({ latencyMs: 0 })
    await services.projects.selectProcess('PJ-DEMO', 'LP-04')
    renderAt('/projects/PJ-DEMO/params?as=user', services, paramsExpandedState({ siteAll: false, breakdown: false }))
    expect(await screen.findByText('Группы персонала не привязаны к процессу')).toBeInTheDocument()
    expect(screen.getByText(/Экономия труда не рассчитается: к процессу не привязаны исполнители/)).toBeInTheDocument()
    expect(matchButton()).toBeEnabled()
  })

  it('сохранённая оценка: процесс не меняется (D-17)', async () => {
    renderAt('/projects/PJ-01/params?as=user')
    await screen.findByRole('heading', { name: '3. Нормативы и допущения расчёта' })
    fireEvent.click(screen.getByRole('radio', { name: 'Упаковка' }))
    expect(screen.getByRole('radio', { name: 'Перемещение паллет' })).toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Процесс проекта' })).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByText(/Черновик сохранён/)).not.toBeInTheDocument()
  })
})
