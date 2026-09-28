import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Popover } from './Popover'
import { ScorePill } from './ScorePill'

describe('ScorePill', () => {
  it('is a toggle button: visible score, hidden explanation, aria-expanded and aria-controls', () => {
    const onClick = vi.fn()
    render(<ScorePill score="0,78" label="Из чего складывается балл Ronavi H1500" expanded={false} controls="why-2" onClick={onClick} />)
    const pill = screen.getByRole('button', { name: '0,78, Из чего складывается балл Ronavi H1500' })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    expect(pill).toHaveAttribute('aria-controls', 'why-2')
    expect(pill).toHaveClass('bg-surface-sunken', 'h-24')
    fireEvent.click(pill)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('selected tone is inverse with lime text', () => {
    render(<ScorePill score="0,91" label="Разбор" tone="selected" />)
    expect(screen.getByRole('button')).toHaveClass('bg-inverse', 'text-on-inverse')
  })

  it('without a score shows a dash and no button', () => {
    render(<ScorePill score={null} label="Разбор" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('works as a Popover trigger: Radix sets aria-expanded', () => {
    render(<Popover label="Разбор балла" trigger={<ScorePill score="0,91" label="Разбор балла" />}><p>Окупаемость</p></Popover>)
    const pill = screen.getByRole('button', { name: /0,91/ })
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Разбор балла' })).toBeInTheDocument()
  })
})
