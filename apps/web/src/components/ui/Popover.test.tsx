import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Popover } from './Popover'

describe('Popover', () => {
  it('opens a panel named by its title with body and action, closes with Escape and returns focus', async () => {
    render(
      <Popover title="Нет данных для оценки: 2 значения" trigger={<Button>Не хватает данных</Button>} action={<Button>Уточнить параметры площадки</Button>}>
        <p>Значения заполняются в профиле локации</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Не хватает данных' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    const panel = await screen.findByRole('dialog', { name: 'Нет данных для оценки: 2 значения' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveClass('w-(--rav-popover-width)', 'shadow-popover')
    expect(screen.getByText('Значения заполняются в профиле локации')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Уточнить параметры площадки' })).toBeInTheDocument()
    fireEvent.keyDown(panel, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(trigger).toHaveFocus()
  })

  it('without a title is named by label and sized by content', () => {
    render(<Popover label="Из чего складывается балл" width="content" defaultOpen trigger={<button type="button">0,91</button>}><p>Окупаемость 0,30</p></Popover>)
    const panel = screen.getByRole('dialog', { name: 'Из чего складывается балл' })
    expect(panel).toHaveClass('w-max')
  })
})
