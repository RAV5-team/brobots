import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { TabPanel, Tabs, type TabItem } from './Tabs'

type Tab = 'overview' | 'tech' | 'infra' | 'quality'
const ITEMS: readonly TabItem<Tab>[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'tech', label: 'Технические' },
  { value: 'infra', label: 'Инфраструктура', disabled: true },
  { value: 'quality', label: 'Качество данных' },
]

function Demo({ initial = 'overview' }: { readonly initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial)
  return (
    <>
      <Tabs id="t" label="Разделы решения" items={ITEMS} value={tab} onChange={setTab} />
      <TabPanel tabsId="t" value={tab}>{`Панель ${tab}`}</TabPanel>
    </>
  )
}

describe('Tabs', () => {
  it('tablist with one selected tab in the Tab order, labelled panel', () => {
    render(<Demo />)
    expect(screen.getByRole('tablist', { name: 'Разделы решения' })).toBeInTheDocument()
    const overview = screen.getByRole('tab', { name: 'Обзор' })
    expect(overview).toHaveAttribute('aria-selected', 'true')
    expect(overview).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Технические' })).toHaveAttribute('tabindex', '-1')
    const panel = screen.getByRole('tabpanel', { name: 'Обзор' })
    expect(overview).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveTextContent('Панель overview')
  })

  it('click selects; arrows move and select, skipping disabled; Home / End jump to the edges', () => {
    render(<Demo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Технические' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Панель tech')
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Качество данных' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Качество данных' })).toHaveFocus()
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Обзор' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Качество данных' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(list, { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Обзор' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(list, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Качество данных' })).toHaveAttribute('aria-selected', 'true')
  })

  it('disabled tab is not selectable', () => {
    render(<Demo />)
    const infra = screen.getByRole('tab', { name: 'Инфраструктура' })
    expect(infra).toBeDisabled()
    fireEvent.click(infra)
    expect(screen.getByRole('tab', { name: 'Обзор' })).toHaveAttribute('aria-selected', 'true')
  })
})
