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

  it('accent tone is the lime «подтверждено» plate with a drop shadow (А6, 15966:7295)', () => {
    render(<Chip tone="accent">подтверждено</Chip>)
    expect(screen.getByText('подтверждено')).toHaveClass('bg-accent-surface', 'text-text', 'drop-shadow-popover')
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

  it('fills «норматив» in the table pill and outlines it next to a field label (15997:409, 15950:2084)', () => {
    render(<><Badge kind="norm" variant="pill" /><Badge kind="norm" /></>)
    const [pill, field] = screen.getAllByText('норматив')
    expect(pill).toHaveClass('bg-surface-sunken', 'text-text')
    expect(pill).not.toHaveClass('border')
    expect(field).toHaveClass('border', 'border-border-strong')
  })

  it('keeps the dashed outline of «допущение» in both variants', () => {
    render(<Badge kind="assumption" variant="pill" />)
    expect(screen.getByText('допущение')).toHaveClass('border-dashed')
  })
})
