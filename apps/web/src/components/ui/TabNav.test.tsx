import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TabNav } from './TabNav'

const ITEMS = [
  { key: 'a', label: 'Каталог', to: '/admin/catalog' },
  { key: 'b', label: 'Классы операций', to: '/admin/operation-classes' },
] as const

describe('TabNav', () => {
  it('renders a labelled navigation with one link per tab', () => {
    render(<MemoryRouter><TabNav label="Разделы администрирования" items={ITEMS} activeKey="b" /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'Разделы администрирования' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/admin/catalog')
  })

  it('marks only the active tab with aria-current="page"', () => {
    render(<MemoryRouter><TabNav label="Разделы" items={ITEMS} activeKey="b" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Классы операций' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Каталог' })).not.toHaveAttribute('aria-current')
  })
})
