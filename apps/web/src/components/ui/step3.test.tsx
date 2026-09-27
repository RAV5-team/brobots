import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { Chip, ChipToggle } from './Chip'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('is a switch named by its label', () => {
    const onChange = vi.fn()
    render(<Toggle label="Автообновление" onCheckedChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: 'Автообновление' })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Chip', () => {
  it('renders static text', () => {
    render(<Chip>OP-01</Chip>)
    expect(screen.getByText('OP-01')).toBeInTheDocument()
  })

  it('toggle chip exposes its pressed state', () => {
    render(<ChipToggle defaultPressed={false}>Вилы</ChipToggle>)
    const chip = screen.getByRole('button', { name: 'Вилы' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Badge', () => {
  it.each([
    ['assumption', 'допущение'], ['formula', 'формула'], ['norm', 'норматив'], ['exact', 'точное значение'],
  ] as const)('%s → «%s»', (kind, label) => {
    render(<Badge kind={kind} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
