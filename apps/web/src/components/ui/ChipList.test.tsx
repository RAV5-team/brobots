import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ChipList } from './ChipList'

const ITEMS = [
  { key: 'a', label: 'AMR 800', to: '/catalog/RB-0008' },
  { key: 'b', label: 'Все наземные роботы' },
  { key: 'c', label: 'Fleet Manager', to: '/catalog/SI-SW-01' },
  { key: 'd', label: 'SmartCube' },
]

const renderList = (max?: number) =>
  render(<MemoryRouter><ChipList items={ITEMS} label="Совместимо" {...(max === undefined ? {} : { max })} /></MemoryRouter>)

describe('ChipList (D-65)', () => {
  it('shows every chip without a limit, links only positions with an address', () => {
    renderList()
    const list = within(screen.getByRole('list', { name: 'Совместимо' }))
    expect(list.getAllByRole('listitem')).toHaveLength(4)
    expect(list.getByRole('link', { name: 'AMR 800' })).toHaveAttribute('href', '/catalog/RB-0008')
    expect(list.queryByRole('link', { name: 'SmartCube' })).toBeNull()
  })

  it('folds the rest into one «ещё N» chip that names the hidden values', () => {
    renderList(2)
    const list = within(screen.getByRole('list', { name: 'Совместимо' }))
    expect(list.getAllByRole('listitem')).toHaveLength(3)
    expect(list.getByText('ещё 2')).toBeInTheDocument()
    expect(list.getByRole('listitem', { name: 'ещё: Fleet Manager, SmartCube' })).toBeInTheDocument()
  })
})
