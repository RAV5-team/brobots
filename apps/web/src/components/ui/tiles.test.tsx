import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'
import { StatTile } from './StatTile'
import { Well } from './Well'

describe('StatTile', () => {
  it('renders a list item with label, value and caption; lg light by default', () => {
    render(<ul><StatTile label="CAPEX" value="6,1 млн ₽" caption="в рамках бюджета" /></ul>)
    const item = screen.getByRole('listitem')
    expect(item).toHaveClass('rounded-lg', 'bg-surface-sunken', 'p-16')
    expect(screen.getByText('6,1 млн ₽')).toHaveClass('type-title-md', 'text-text')
    expect(screen.getByText('в рамках бюджета')).toHaveClass('type-caption', 'font-medium')
  })

  it('omits the caption when there is none', () => {
    render(<ul><StatTile size="sm" label="Пик" value="130" /></ul>)
    expect(screen.getByRole('listitem').children).toHaveLength(2)
    expect(screen.getByText('130')).toHaveClass('type-body', 'font-semibold')
  })

  it('renders a term/definition pair inside a description list with extra layout classes', () => {
    render(<dl><StatTile as="term" size="md" className="shrink-0" label="Класс операции" value="OP-01" /></dl>)
    expect(screen.getByRole('term')).toHaveTextContent('Класс операции')
    expect(screen.getByRole('definition')).toHaveClass('type-heading')
    expect(screen.getByRole('definition').parentElement).toHaveClass('rounded-md', 'p-12', 'shrink-0')
  })

  it('renders the inverse tone as a well of a dark card', () => {
    render(<ul><StatTile tone="inverse" label="OPEX" value="42 млн ₽" caption="сейчас 51,2 млн ₽" /></ul>)
    expect(screen.getByRole('listitem')).toHaveClass('bg-inverse-well', 'px-16', 'py-14')
    expect(screen.getByText('42 млн ₽')).toHaveClass('text-bg')
    expect(screen.getByText('сейчас 51,2 млн ₽')).toHaveClass('text-text-disabled')
  })
})

describe('Well', () => {
  it('is a section named by its overline title', () => {
    render(<Well title="Где тоньше всего"><p>Зарядка в пик</p></Well>)
    expect(screen.getByRole('region', { name: 'Где тоньше всего' })).toHaveClass('bg-inverse-well')
    expect(screen.getByRole('heading', { level: 3, name: 'Где тоньше всего' })).toHaveClass('type-overline')
  })
})

describe('PageHeader', () => {
  it('renders h1 and lead with gap 4 by default', () => {
    render(<PageHeader title="Процессы" lead="Типовые процессы" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Процессы' })
    expect(heading.parentElement?.tagName).toBe('HEADER')
    expect(heading.parentElement).toHaveClass('flex', 'flex-col', 'gap-4')
    expect(screen.getByText('Типовые процессы')).toHaveClass('type-body', 'text-text-secondary')
  })

  it('renders only the title without a lead; gap 8 for forms', () => {
    const { container } = render(<PageHeader title="Новый робот" gap={8} />)
    expect(container.querySelector('header')).toHaveClass('gap-8')
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('puts actions to the right of the text block', () => {
    render(<PageHeader title="Сравнение" lead="2 из 4" actions={<button type="button">Очистить</button>} />)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('items-end', 'justify-between')
    expect(header.lastElementChild).toHaveTextContent('Очистить')
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveClass('gap-4')
  })
})
