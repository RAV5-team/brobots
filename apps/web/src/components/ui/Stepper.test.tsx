import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Stepper, type StepperStep } from './Stepper'

const STEPS: readonly StepperStep[] = [
  { key: 'params', label: 'Параметры', state: 'done', to: '/p/params' },
  { key: 'matching', label: 'Подбор', state: 'done', to: '/p/matching' },
  { key: 'simulation', label: 'Симуляция', state: 'current', to: '/p/simulation' },
  { key: 'economics', label: 'Итог и экономика', state: 'locked', to: '/p/economics' },
]

const renderStepper = (props: Partial<Parameters<typeof Stepper>[0]> = {}) =>
  render(<MemoryRouter><Stepper label="Шаги проекта" steps={STEPS} {...props} /></MemoryRouter>)

describe('Stepper · pills (шаги проекта)', () => {
  it('навигация со списком шагов по порядку', () => {
    renderStepper()
    const nav = screen.getByRole('navigation', { name: 'Шаги проекта' })
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4)
  })

  it('пройденные шаги — ссылки, текущий отмечен aria-current="step" и не ссылка', () => {
    renderStepper()
    expect(screen.getByRole('link', { name: /Параметры/ })).toHaveAttribute('href', '/p/params')
    expect(screen.getByRole('link', { name: /Параметры/ })).toHaveAccessibleName('Шаг 1. Параметры, пройден')
    const current = screen.getByText('Симуляция').closest('[aria-current]')
    expect(current).toHaveAttribute('aria-current', 'step')
    expect(screen.queryByRole('link', { name: /Симуляция/ })).not.toBeInTheDocument()
  })

  it('закрытый шаг не ссылка и объявлен недоступным', () => {
    renderStepper()
    expect(screen.queryByRole('link', { name: /Итог/ })).not.toBeInTheDocument()
    // aria-disabled у нефокусируемого span скринридер не озвучивает — состояние в тексте шага.
    expect(screen.getByText(', недоступен')).toHaveClass('sr-only')
    expect(screen.getByText(', недоступен').parentElement).toHaveTextContent('Шаг 4. Итог и экономика, недоступен')
    expect(screen.getByText('Итог и экономика').closest('[aria-disabled]')).toBeNull()
  })

  it('доступный, но не пройденный шаг — ссылка без пометки «пройден»', () => {
    renderStepper({ steps: STEPS.map((s) => (s.key === 'economics' ? { ...s, state: 'available' } : s)) })
    expect(screen.getByRole('link', { name: 'Шаг 4. Итог и экономика' })).toHaveAttribute('href', '/p/economics')
  })

  it('сохранённая оценка: все шаги кликабельны в режиме просмотра', () => {
    renderStepper({ steps: STEPS.map((s) => (s.state === 'current' ? s : { ...s, state: 'done' })) })
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})

describe('Stepper · segments (этапы симуляции)', () => {
  const STAGES: readonly StepperStep[] = [
    { key: 'scope', label: '1. Что проверяем', state: 'done' },
    { key: 'conditions', label: '2. Условия симуляции', state: 'current' },
    { key: 'run', label: '3. Прогон', state: 'locked' },
    { key: 'verdict', label: '4. Вердикт', state: 'locked' },
  ]

  it('этапы без адресов — индикатор, текущий этап отмечен', () => {
    renderStepper({ variant: 'segments', label: 'Этапы симуляции', steps: STAGES })
    expect(screen.getByRole('navigation', { name: 'Этапы симуляции' })).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('2. Условия симуляции').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
  })

  it('этап с адресом — ссылка (вернуться к пройденному этапу)', () => {
    renderStepper({ variant: 'segments', label: 'Этапы симуляции', steps: STAGES.map((s) => (s.key === 'scope' ? { ...s, to: '?stage=scope' } : s)) })
    expect(screen.getByRole('link', { name: /Что проверяем/ })).toHaveAttribute('href', '/?stage=scope')
  })
})

describe('Stepper · pills, метка после подписи (доска 16325)', () => {
  it('подпись, затем ✓ у пройденного или номер; имя шага для чтения с экрана то же', () => {
    renderStepper({ marker: 'end' })
    const done = screen.getByRole('link', { name: 'Шаг 1. Параметры, пройден' })
    expect(done).toHaveAttribute('href', '/p/params')
    expect(done.lastElementChild?.querySelector('svg')).not.toBeNull()
    const current = screen.getByText('Симуляция').closest('[aria-current]')
    expect(current).toHaveAttribute('aria-current', 'step')
    expect(current?.lastElementChild).toHaveTextContent('3')
    expect(current?.lastElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Итог и экономика').closest('span')).toHaveTextContent('Шаг 4. Итог и экономика, недоступен4')
  })

  it('без marker — прежний вид: номер в круге перед подписью', () => {
    renderStepper()
    const current = screen.getByText('Симуляция').closest('[aria-current]')
    expect(current?.firstElementChild).toHaveTextContent('3')
  })
})

describe('Stepper · capsule (этапы симуляции на доске 16325)', () => {
  const STAGES: readonly StepperStep[] = [
    { key: 'scope', label: '1. Что проверяется', state: 'done', to: '?stage=scope' },
    { key: 'conditions', label: '2. Условия симуляции', state: 'current', to: '?stage=conditions' },
    { key: 'run', label: '3. Моделирование', state: 'locked', to: '?stage=run' },
    { key: 'verdict', label: '4. Вердикт', state: 'locked' },
  ]

  it('капсула из равных пунктов: пройденный — ссылка, текущий — aria-current, закрытый — не ссылка с пометкой', () => {
    renderStepper({ variant: 'capsule', label: 'Этапы симуляции', steps: STAGES })
    const nav = screen.getByRole('navigation', { name: 'Этапы симуляции' })
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4)
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: '1. Что проверяется, пройден' })).toHaveAttribute('href', '/?stage=scope')
    expect(screen.getByText('2. Условия симуляции').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('3. Моделирование')).toHaveTextContent('3. Моделирование, недоступен')
  })
})
