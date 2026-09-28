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
