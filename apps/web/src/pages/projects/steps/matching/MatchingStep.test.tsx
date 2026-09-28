import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { MatchingStep } from './MatchingStep'

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/matching" element={<ProjectStepPage step="matching" Step={MatchingStep} />} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const ranking = () => screen.getByRole('table', { name: /Рейтинг вариантов подбора/ })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 2 «Подбор решения» (экран 03, PRD 11.3)', () => {
  it('условия, рекомендация, рейтинг 8 вариантов и 4 исключённых', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    expect(await screen.findByRole('region', { name: 'AMR 800 · RaaS' })).toHaveTextContent('Рекомендация системы · место 1')
    expect(screen.getByText(/6 жёстких фильтров из параметров процесса и локации · 8 вариантов прошли · 4 решения исключены/)).toBeInTheDocument()
    expect(within(ranking()).getAllByRole('row')).toHaveLength(9)
    const excluded = screen.getByRole('region', { name: 'Исключённые решения' })
    expect(within(excluded).getAllByRole('button', { name: /Добавить вручную/ })).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Выбранный вариант' })).toHaveTextContent('AMR 800 · RaaS')
  })

  it('выбор другого варианта сохраняется в черновик (D-21)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/matching?as=user', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Выбрать вариант AMR 800 · Покупка' }))
    expect(update).toHaveBeenCalledWith('PJ-DEMO', { matching: { selection: { solutionId: 'RB-0008', acquisition: 'purchase' } } })
    expect(await screen.findByText(/Черновик сохранён/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Выбранный вариант' })).toHaveTextContent('AMR 800 · Покупка')
  })

  it('правка «Параметров расчёта» делает подбор устаревшим, пересчёт снимает пометку (D-89)', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: /Изменить параметры расчёта/ }))
    const panel = await screen.findByRole('dialog', { name: 'Параметры расчёта' })
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Коэффициент загрузки' }), { target: { value: '1,5' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Готово' }))
    expect(await within(panel).findByText('Введите число от 0,05 до 1')).toBeInTheDocument()
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Коэффициент загрузки' }), { target: { value: '0,7' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Готово' }))
    expect(await screen.findByText('Параметры изменились — рейтинг посчитан по прежним значениям')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти к симуляции' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Пересчитать' }))
    await waitFor(() => { expect(screen.queryByText('Параметры изменились — рейтинг посчитан по прежним значениям')).not.toBeInTheDocument() })
    expect(screen.getByRole('button', { name: 'Перейти к симуляции' })).toBeEnabled()
  })

  it('ручное добавление и сравнение: вне рейтинга, критическое несоответствие', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить вручную: Ronavi SD' }))
    expect(screen.getByText(/Критическое несоответствие: Класс операции/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Добавить к сравнению: AMR 800 · RaaS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сравнить выбранные · 2' }))
    const compare = await screen.findByRole('table', { name: 'Сравнение выбранных вариантов подбора' })
    expect(within(compare).getAllByText('не рассчитано').length).toBeGreaterThan(0)
  })

  it('гость: выбор на странице без сохранения (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/matching?as=guest', services)
    fireEvent.click(await screen.findByRole('button', { name: 'Выбрать вариант Ronavi H1500 · RaaS' }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('Демо-режим: выбор не сохраняется')).toBeInTheDocument()
  })

  it('сохранённая оценка — только просмотр: нет выбора, ручного добавления и параметров (D-17)', async () => {
    renderAt('/projects/PJ-01/matching?as=user')
    await screen.findByRole('region', { name: 'AMR 800 · RaaS' })
    expect(screen.queryByRole('button', { name: /^Выбрать вариант/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Добавить вручную/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Изменить параметры расчёта/ })).not.toBeInTheDocument()
  })

  it('«Как рассчитано» (03a): расчёт выбранного варианта, вклад = балл, веса только для чтения', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Как рассчитано' }))
    const panel = await screen.findByRole('dialog', { name: 'Как рассчитано' })
    expect(within(panel).getByText(/AMR 800 · RaaS для процесса «Перемещение паллет»/)).toBeInTheDocument()
    for (const title of ['1. Потребность', '2. Цикл и парк', '3. Деньги', '4. Балл рейтинга']) {
      expect(within(panel).getByRole('heading', { name: title })).toBeInTheDocument()
    }
    const score = within(panel).getByRole('region', { name: '4. Балл рейтинга' })
    expect(within(score).getByText('сумма вкладов = 0,91')).toBeInTheDocument()
    expect(within(panel).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Формулы и источники' })).toHaveAttribute('href', '/help')
  })

  it('панель показывает выбранный вариант, а не рекомендацию', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Выбрать вариант AMR 800 · Покупка' }))
    fireEvent.click(screen.getByRole('button', { name: 'Как рассчитан рейтинг' }))
    const panel = await screen.findByRole('dialog', { name: 'Как рассчитано' })
    expect(within(panel).getByText(/AMR 800 · Покупка для процесса/)).toBeInTheDocument()
    expect(within(panel).getByText('Вклад критериев для этого варианта не рассчитан')).toBeInTheDocument()
  })
})
