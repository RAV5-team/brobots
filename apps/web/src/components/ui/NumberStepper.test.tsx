import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberStepper } from './NumberStepper'

function Controlled({ initial = 18, onChange }: { readonly initial?: number; readonly onChange?: (v: number) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <NumberStepper
      label="Роботов"
      description="AMR 800 · RaaS"
      value={value}
      min={1}
      max={20}
      onChange={(v) => { setValue(v); onChange?.(v) }}
    />
  )
}

describe('NumberStepper', () => {
  it('значение — spinbutton с именем по подписи и границами', () => {
    render(<Controlled />)
    const spin = screen.getByRole('spinbutton', { name: 'Роботов' })
    expect(spin).toHaveAttribute('aria-valuenow', '18')
    expect(spin).toHaveAttribute('aria-valuemin', '1')
    expect(spin).toHaveAttribute('aria-valuemax', '20')
    expect(spin).toHaveAccessibleDescription('AMR 800 · RaaS')
  })

  it('кнопки − и + меняют значение на шаг и подписаны для чтения с экрана', () => {
    render(<Controlled />)
    fireEvent.click(screen.getByRole('button', { name: 'Уменьшить: Роботов' }))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '17')
    fireEvent.click(screen.getByRole('button', { name: 'Увеличить: Роботов' }))
    fireEvent.click(screen.getByRole('button', { name: 'Увеличить: Роботов' }))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '19')
  })

  it('клавиатура: стрелки ↑ ↓ и → ←, Home и End — к границам', () => {
    render(<Controlled />)
    const spin = screen.getByRole('spinbutton')
    fireEvent.keyDown(spin, { key: 'ArrowUp' })
    fireEvent.keyDown(spin, { key: 'ArrowRight' })
    expect(spin).toHaveAttribute('aria-valuenow', '20')
    fireEvent.keyDown(spin, { key: 'ArrowDown' })
    fireEvent.keyDown(spin, { key: 'ArrowLeft' })
    expect(spin).toHaveAttribute('aria-valuenow', '18')
    fireEvent.keyDown(spin, { key: 'Home' })
    expect(spin).toHaveAttribute('aria-valuenow', '1')
    fireEvent.keyDown(spin, { key: 'End' })
    expect(spin).toHaveAttribute('aria-valuenow', '20')
  })

  it('на границе значение не выходит за неё, кнопка недоступна', () => {
    const onChange = vi.fn()
    render(<Controlled initial={20} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Увеличить: Роботов' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('слоты «было» и дельта — необязательные; «было» входит в описание', () => {
    render(<NumberStepper label="Роботов" previous="было 18 · из подбора" delta="−2" value={16} min={1} max={60} onChange={() => undefined} />)
    expect(screen.getByRole('spinbutton', { name: 'Роботов' })).toHaveAccessibleDescription('было 18 · из подбора −2')
    const shown = screen.getAllByText('−2').filter((el) => !el.classList.contains('sr-only'))
    expect(shown).toHaveLength(1)
    expect(shown[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('недоступный — без изменений ни кнопками, ни клавиатурой', () => {
    const onChange = vi.fn()
    render(<NumberStepper label="Роботов" value={5} min={1} max={9} disabled onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Уменьшить: Роботов' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('NumberStepper · block (правая колонка вердикта)', () => {
  it('подпись, пояснение и чип входят в описание; кнопки и клавиатура работают как в строке', () => {
    const onChange = vi.fn()
    render(
      <NumberStepper
        layout="block"
        label="Зарядных станций"
        description="из подбора: 5"
        previous="рекомендация: 6"
        badge={<span>+1</span>}
        value={6}
        min={1}
        max={20}
        onChange={onChange}
      />,
    )
    const spin = screen.getByRole('spinbutton', { name: 'Зарядных станций' })
    expect(spin).toHaveAccessibleDescription('из подбора: 5 рекомендация: 6 +1')
    fireEvent.click(screen.getByRole('button', { name: 'Увеличить: Зарядных станций' }))
    expect(onChange).toHaveBeenLastCalledWith(7)
    fireEvent.keyDown(spin, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('без чипа — описание только из пояснения; чип в строчном виде не выводится', () => {
    const { rerender } = render(<NumberStepper layout="block" label="Роботов" description="из подбора: 18" value={18} min={1} max={60} onChange={() => undefined} />)
    expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription('из подбора: 18')
    rerender(<NumberStepper label="Роботов" badge={<span>без изменений</span>} value={18} min={1} max={60} onChange={() => undefined} />)
    expect(screen.queryByText('без изменений')).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-describedby')
  })
})
