import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TabNav } from './TabNav'

const ITEMS = [
  { label: 'Каталог', to: '/admin/catalog' },
  { label: 'Классы операций', to: '/admin/operation-classes' },
] as const

describe('TabNav', () => {
  it('renders a labelled navigation with one link per tab', () => {
    render(<MemoryRouter><TabNav label="Разделы администрирования" items={ITEMS} activeTo="/admin/operation-classes" /></MemoryRouter>)
    expect(screen.getByRole('navigation', { name: 'Разделы администрирования' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/admin/catalog')
  })

  it('marks only the explicitly active tab with aria-current="page"', () => {
    render(<MemoryRouter><TabNav label="Разделы" items={ITEMS} activeTo="/admin/operation-classes" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Классы операций' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Каталог' })).not.toHaveAttribute('aria-current')
  })

  it('finds the active tab by the address when none is given', () => {
    render(<MemoryRouter initialEntries={['/admin/catalog']}><TabNav label="Разделы" items={ITEMS} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
  })
})
