import { fireEvent, render, screen } from '@testing-library/react'
import { ArrowRight } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink } from './Button'
import { Field } from './Field'
import { IconButton } from './IconButton'
import { Input } from './Input'
import { Search } from './Search'

describe('Button', () => {
  it('renders a native button that is not a form submit by default', () => {
    render(<Button>Все проекты</Button>)
    expect(screen.getByRole('button', { name: 'Все проекты' })).toHaveAttribute('type', 'button')
  })

  it('does not fire clicks when disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Сохранить</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a link with the same look', () => {
    render(<MemoryRouter><ButtonLink to="/projects" variant="secondary" size="sm">Все проекты</ButtonLink></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Все проекты' })).toHaveAttribute('href', '/projects')
  })
})

describe('IconButton', () => {
  it('is named by its label, the icon is hidden', () => {
    render(<IconButton label="Открыть проект" icon={ArrowRight} />)
    const button = screen.getByRole('button', { name: 'Открыть проект' })
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Field + Input', () => {
  it('links label, hint and control', () => {
    render(<Field label="Название процесса" hint="Как в справочнике"><Input defaultValue="Перемещение паллет" /></Field>)
    const input = screen.getByLabelText('Название процесса')
    expect(input).toHaveAccessibleDescription('Как в справочнике')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the control invalid and describes it with the error instead of the hint', () => {
    render(
      <Field label="Площадь активной зоны" required hint="м²" error="Больше общей площади склада — 20 000 м²">
        <Input defaultValue="22 000" suffix="м²" />
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: /Площадь активной зоны/ })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('Больше общей площади склада — 20 000 м²')
  })

  it('renders a computed value read-only', () => {
    render(<Field label="Коэффициент начислений"><Input value="1,302" computed /></Field>)
    expect(screen.getByLabelText('Коэффициент начислений')).toHaveAttribute('readonly')
  })

  it('puts a text action inside the capsule that never submits the form (А7б «Проверить»)', () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => { event.preventDefault() })
    render(
      <form onSubmit={onSubmit}>
        <Field label="Ссылка на источник"><Input defaultValue="https://moros.ru" action={{ label: 'Проверить', ariaLabel: 'Проверить ссылку', onClick }} /></Field>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Проверить ссылку' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks the action while it runs', () => {
    render(<Input aria-label="Ссылка" action={{ label: 'Проверяем…', onClick: vi.fn(), disabled: true }} />)
    expect(screen.getByRole('button', { name: 'Проверяем…' })).toBeDisabled()
  })
})

describe('Search', () => {
  it('is a search box named by its placeholder label', () => {
    render(<Search label="Найти процесс" />)
    expect(screen.getByRole('searchbox', { name: 'Найти процесс' })).toHaveAttribute('placeholder', 'Найти процесс')
  })
})
