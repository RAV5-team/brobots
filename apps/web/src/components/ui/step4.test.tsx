import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardStat, CardTitle, KpiCard } from './Card'
import { Progress } from './Progress'
import { SectionHeader } from './SectionHeader'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table'

describe('Card', () => {
  it('renders a titled card with stat rows as a description list', () => {
    render(<Card><CardTitle>Проверка шаблона</CardTitle><dl><CardStat label="Формул" value="3" /></dl></Card>)
    expect(screen.getByText('Проверка шаблона')).toBeInTheDocument()
    expect(screen.getByRole('term')).toHaveTextContent('Формул')
    expect(screen.getByRole('definition')).toHaveTextContent('3')
  })

  it('KPI card shows label, value and caption', () => {
    render(<KpiCard label="Локаций" value="4" caption="склад, аэропорт, медучреждение" />)
    expect(screen.getByText('Локаций')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})

describe('SectionHeader', () => {
  it('renders a heading of the requested level with a description', () => {
    render(<SectionHeader level={2} title="1. Процесс и груз" description="Что перемещаем" />)
    expect(screen.getByRole('heading', { level: 2, name: '1. Процесс и груз' })).toBeInTheDocument()
  })
})

describe('Table', () => {
  it('renders a semantic table', () => {
    render(
      <Table caption="Нормативы">
        <TableHead><TableRow><TableHeaderCell>Норматив</TableHeaderCell><TableHeaderCell align="end">Значение</TableHeaderCell></TableRow></TableHead>
        <TableBody><TableRow><TableCell>Смен в сутки</TableCell><TableCell align="end">2</TableCell></TableRow></TableBody>
      </Table>,
    )
    const table = screen.getByRole('table', { name: 'Нормативы' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
    expect(within(table).getByRole('cell', { name: '2' })).toBeInTheDocument()
  })
})

describe('Progress', () => {
  it('exposes value and label to assistive tech', () => {
    render(<Progress label="Опрос источников" value={66} />)
    const bar = screen.getByRole('progressbar', { name: 'Опрос источников' })
    expect(bar).toHaveAttribute('aria-valuenow', '66')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps the value into 0…100', () => {
    render(<Progress label="x" value={140} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
