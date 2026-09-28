import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('uncontrolled: closed by default, the button controls a hidden panel', () => {
    render(<Disclosure title="Объём и нагрузка" caption="5 параметров" variant="group"><p>Пиковая нагрузка</p></Disclosure>)
    const button = screen.getByRole('button', { name: /Объём и нагрузка/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeVisible()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(screen.getByText('5 параметров')).toBeInTheDocument()
  })

  it('defaultOpen starts expanded; onOpenChange reports the next state', () => {
    const onOpenChange = vi.fn()
    render(<Disclosure title="Условия отбора" defaultOpen onOpenChange={onOpenChange}><p>Класс операции</p></Disclosure>)
    expect(screen.getByText('Класс операции')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Условия отбора' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.getByText('Класс операции')).not.toBeVisible()
  })

  it('controlled: follows the open prop', () => {
    function Controlled() {
      const [open, setOpen] = useState(true)
      return <Disclosure title="Сравнение" open={open} onOpenChange={setOpen}><p>Таблица</p></Disclosure>
    }
    render(<Controlled />)
    const button = screen.getByRole('button', { name: 'Сравнение' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('section heading level puts the button inside a heading; aside stays outside the button', () => {
    render(<Disclosure title="Сравнение с текущим процессом" headingLevel={2} aside={<button type="button">Все параметры</button>}><p>Таблица</p></Disclosure>)
    const heading = screen.getByRole('heading', { level: 2, name: 'Сравнение с текущим процессом' })
    expect(heading.querySelector('button')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Все параметры' }).closest('h2')).toBeNull()
  })

  it('chip trigger: danger tone, disabled does not toggle', () => {
    const { rerender } = render(<Disclosure variant="chip" tone="danger" title="4 не прошли фильтры"><p>Ronavi SD</p></Disclosure>)
    const chip = screen.getByRole('button', { name: '4 не прошли фильтры' })
    expect(chip).toHaveClass('border-danger-border', 'text-danger', 'h-24')
    fireEvent.click(chip)
    expect(screen.getByText('Ronavi SD')).toBeVisible()
    rerender(<Disclosure variant="chip" title="4 не прошли фильтры" disabled><p>Ronavi SD</p></Disclosure>)
    expect(screen.getByRole('button', { name: '4 не прошли фильтры' })).toBeDisabled()
  })
})
