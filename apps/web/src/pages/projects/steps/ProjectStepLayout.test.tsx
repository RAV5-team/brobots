import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Project } from '@/domain'
import { DEMO_PROJECT, PROJECTS } from '@/mocks/fixtures/projects'
import { ProjectStepLayout } from './ProjectStepLayout'

const saved = PROJECTS.find((p) => p.id === 'PJ-01') as Project

function renderLayout(props: Partial<Parameters<typeof ProjectStepLayout>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ProjectStepLayout project={DEMO_PROJECT} locationName="РЦ Химки" step="matching" isGuest={false} title="Подбор решения под процесс" {...props}>
        <p>Содержание шага</p>
      </ProjectStepLayout>
    </MemoryRouter>,
  )
}

describe('ProjectStepLayout', () => {
  it('крошки: список проектов и локация — ссылки, проект — текущая страница', () => {
    renderLayout()
    const crumbs = within(screen.getByRole('navigation', { name: 'Путь к проекту' }))
    expect(crumbs.getByRole('link', { name: 'Проекты' })).toHaveAttribute('href', '/projects')
    expect(crumbs.getByRole('link', { name: 'РЦ Химки' })).toHaveAttribute('href', '/locations/LOC-01')
    expect(crumbs.getByText('Демо-проект · РЦ Химки')).toHaveAttribute('aria-current', 'page')
  })

  it('заголовок шага, пояснение и содержание', () => {
    renderLayout({ lead: 'Один процесс — одно решение' })
    expect(screen.getByRole('heading', { level: 1, name: 'Подбор решения под процесс' })).toBeInTheDocument()
    expect(screen.getByText('Один процесс — одно решение')).toBeInTheDocument()
    expect(screen.getByText('Содержание шага')).toBeInTheDocument()
  })

  it('степпер 4 шагов: открытый шаг текущий, пройденные — ссылки на свои адреса', () => {
    renderLayout()
    const steps = within(screen.getByRole('navigation', { name: 'Шаги проекта' }))
    expect(steps.getAllByRole('listitem')).toHaveLength(4)
    expect(steps.getByRole('link', { name: 'Шаг 1. Параметры проекта, пройден' })).toHaveAttribute('href', '/projects/PJ-DEMO/params')
    expect(steps.getByText('Подбор решения').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
  })

  it('гостю — демо-плашка, а список проектов ему закрыт: «Проекты» текстом (D-82)', () => {
    renderLayout({ isGuest: true })
    expect(screen.getByRole('status')).toHaveTextContent('Демо-режим · изменения не сохраняются')
    const crumbs = within(screen.getByRole('navigation', { name: 'Путь к проекту' }))
    expect(crumbs.queryByRole('link', { name: 'Проекты' })).not.toBeInTheDocument()
    expect(crumbs.getByText('Проекты')).toBeInTheDocument()
  })

  it('сохранённая оценка — плашка «только просмотр», все шаги открываются (D-17)', () => {
    renderLayout({ project: saved, step: 'params' })
    expect(screen.getByText('Оценка готова · только просмотр')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Шаги проекта' })).getAllByRole('link')).toHaveLength(3)
  })

  it('правая колонка — отдельная область; действия — рядом с заголовком; слот над заголовком', () => {
    renderLayout({ rail: <p>Выбранный вариант</p>, actions: <button type="button">RaaS</button>, aboveTitle: <p>Этапы</p>, overline: 'Итог оценки' })
    expect(within(screen.getByRole('complementary')).getByText('Выбранный вариант')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RaaS' })).toBeInTheDocument()
    expect(screen.getByText('Этапы')).toBeInTheDocument()
    expect(screen.getByText('Итог оценки')).toBeInTheDocument()
  })

  it('без правой колонки — содержание во всю ширину', () => {
    renderLayout()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})

describe('ProjectStepLayout · board (доска 16325)', () => {
  const board = (props: Partial<Parameters<typeof ProjectStepLayout>[0]> = {}) =>
    renderLayout({ layout: 'board', step: 'simulation', status: <span>Черновик сохранён · 15.09 14:32</span>, ...props })

  it('«← Проекты» ссылкой и статус вместо крошек', () => {
    board()
    expect(screen.queryByRole('navigation', { name: 'Путь к проекту' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Проекты' })).toHaveAttribute('href', '/projects')
    expect(screen.getByText('Черновик сохранён · 15.09 14:32')).toBeInTheDocument()
  })

  it('гостю «Проекты» текстом (D-82) и демо-плашка вместо статуса', () => {
    board({ isGuest: true })
    expect(screen.queryByRole('link', { name: 'Проекты' })).not.toBeInTheDocument()
    expect(screen.getByText('Проекты')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Демо-режим · изменения не сохраняются')
    expect(screen.queryByText('Черновик сохранён · 15.09 14:32')).not.toBeInTheDocument()
  })

  it('сохранённая оценка — «только просмотр» вместо статуса', () => {
    board({ project: saved })
    expect(screen.getByText('Оценка готова · только просмотр')).toBeInTheDocument()
    expect(screen.queryByText('Черновик сохранён · 15.09 14:32')).not.toBeInTheDocument()
  })

  it('степпер с короткими подписями, текущий шаг отмечен', () => {
    board()
    const steps = within(screen.getByRole('navigation', { name: 'Шаги проекта' }))
    expect(steps.getByRole('link', { name: 'Шаг 2. Подбор, пройден' })).toHaveAttribute('href', '/projects/PJ-DEMO/matching')
    expect(steps.getByText('Симуляция').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
  })

  it('заголовок вне колонок; этапы и содержание — в основной колонке, rail — рядом с ней', () => {
    board({ stages: <nav aria-label="Этапы симуляции" />, rail: <p>Что проверит симуляция</p> })
    const heading = screen.getByRole('heading', { level: 1, name: 'Подбор решения под процесс' })
    const rail = screen.getByRole('complementary')
    expect(rail).not.toContainElement(heading)
    const columns = rail.parentElement as HTMLElement
    expect(columns).not.toContainElement(heading)
    expect(columns).toHaveClass('gap-24')
    const main = within(columns.firstElementChild as HTMLElement)
    expect(main.getByRole('navigation', { name: 'Этапы симуляции' })).toBeInTheDocument()
    expect(main.getByText('Содержание шага')).toBeInTheDocument()
  })
})
