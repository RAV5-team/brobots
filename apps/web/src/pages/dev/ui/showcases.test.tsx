import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SHOWCASES } from './showcases'
import { UiShowcase } from './UiShowcase'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/dev/ui/:primitive?" element={<UiShowcase />} /></Routes>
    </MemoryRouter>,
  )

describe('UI showcase', () => {
  it('lists every primitive on the index page', () => {
    renderAt('/dev/ui')
    expect(screen.getByRole('heading', { level: 1, name: 'Примитивы UI' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Примитивы UI' })).getAllByRole('link')).toHaveLength(SHOWCASES.length)
  })

  it.each(SHOWCASES.map((s) => [s.slug, s.title]))('renders /dev/ui/%s', (slug, title) => {
    renderAt(`/dev/ui/${slug}`)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    const nav = within(screen.getByRole('navigation', { name: 'Примитивы UI' }))
    expect(nav.getByRole('link', { current: 'page' })).toHaveTextContent(title)
  })
})
