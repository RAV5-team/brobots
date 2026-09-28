import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { HourGrid } from './HourGrid'

const HOURS = [7, 8, 9, 10]

function Demo({ disabled = false }: { readonly disabled?: boolean }) {
  const [selected, setSelected] = useState<readonly number[]>([8])
  return (
    <HourGrid label="Приёмка" hours={HOURS} selected={selected} disabledHours={[10]} hourLabel={(h) => `час ${String(h)}`} onChange={setSelected} disabled={disabled} />
  )
}

describe('HourGrid', () => {
  it('клик отмечает и снимает час, час вне смен недоступен', () => {
    render(<Demo />)
    const grid = screen.getByRole('group', { name: 'Приёмка' })
    const seven = within(grid).getByRole('button', { name: 'час 7' })
    fireEvent.click(seven)
    expect(seven).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(grid).getByRole('button', { name: 'час 8' }))
    expect(within(grid).getByRole('button', { name: 'час 8' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(grid).getByRole('button', { name: 'час 10' })).toBeDisabled()
  })

  it('одна остановка Tab, стрелки и End двигают фокус мимо недоступных часов', () => {
    render(<Demo />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    buttons[0]?.focus()
    fireEvent.keyDown(buttons[0] as HTMLElement, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1])
    fireEvent.keyDown(buttons[1] as HTMLElement, { key: 'End' })
    expect(document.activeElement).toBe(buttons[2])
  })

  it('disabled — ничего не отмечается', () => {
    render(<Demo disabled />)
    expect(screen.getByRole('button', { name: 'час 7' })).toBeDisabled()
  })
})
