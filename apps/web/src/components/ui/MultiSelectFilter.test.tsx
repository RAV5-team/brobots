import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MultiSelectFilter, type MultiSelectGroup } from './MultiSelectFilter'

const INDUSTRIES = [
  { value: 'trade', label: 'Торговля и услуги' },
  { value: 'industry', label: 'Промышленность' },
  { value: 'energy', label: 'ТЭК' },
]

const COST: readonly MultiSelectGroup<string>[] = [
  { label: 'Тип затрат', options: [{ value: 'capex', label: 'CAPEX' }, { value: 'opex', label: 'OPEX' }] },
  { label: 'Цена за единицу', options: [{ value: 'low', label: 'до 1 млн ₽' }] },
]

function Harness({ initial = [], grouped = false }: { readonly initial?: readonly string[]; readonly grouped?: boolean }) {
  const [value, setValue] = useState<readonly string[]>(initial)
  return grouped
    ? <MultiSelectFilter label="Стоимость" groups={COST} value={value} onChange={setValue} />
    : <MultiSelectFilter label="Отрасль" searchLabel="Найти отрасль" options={INDUSTRIES} value={value} onChange={setValue} />
}

const open = (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.findByRole('dialog')
}
const press = (key: string) => { fireEvent.keyDown(document.activeElement ?? document.body, { key }) }

describe('MultiSelectFilter', () => {
  it('names the button by the filter, the only value, or the count (PRD 7.4)', () => {
    const { unmount } = render(<Harness />)
    expect(screen.getByRole('button', { name: 'Отрасль' })).toBeInTheDocument()
    unmount()
    const one = render(<Harness initial={['industry']} />)
    expect(screen.getByRole('button', { name: 'Отрасль: Промышленность' })).toBeInTheDocument()
    one.unmount()
    render(<Harness initial={['industry', 'energy']} />)
    expect(screen.getByRole('button', { name: 'Отрасль: 2' })).toBeInTheDocument()
  })

  it('shows the short button label and marks the button active when a value is chosen (К-2)', () => {
    const { unmount } = render(
      <MultiSelectFilter label="Класс операции" options={[{ value: 'OP-01', label: 'OP-01 · Перемещение грузов', buttonLabel: 'OP-01' }]} value={['OP-01']} onChange={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Класс операции: OP-01' })).toHaveAttribute('data-active', 'true')
    unmount()
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Отрасль' })).toHaveAttribute('data-active', 'false')
  })

  it('checks several values and resets them from the footer', async () => {
    render(<Harness />)
    const panel = await open(/Отрасль/)
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Промышленность' }))
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'ТЭК' }))
    expect(screen.getByRole('button', { name: 'Отрасль: 2' })).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Сбросить' }))
    expect(screen.getByRole('button', { name: 'Отрасль' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Сбросить' })).toBeDisabled()
  })

  it('filters values by the search and says when nothing matches', async () => {
    render(<Harness />)
    const panel = await open(/Отрасль/)
    const search = within(panel).getByRole('searchbox', { name: 'Найти отрасль' })
    fireEvent.change(search, { target: { value: 'тэк' } })
    expect(within(panel).getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.change(search, { target: { value: 'космос' } })
    expect(within(panel).getByText('Ничего не найдено')).toBeInTheDocument()
  })

  it('shows values in named groups', async () => {
    render(<Harness grouped />)
    const panel = await open(/Стоимость/)
    expect(within(panel).getByRole('group', { name: 'Тип затрат' })).toBeInTheDocument()
    expect(within(panel).getByRole('group', { name: 'Цена за единицу' })).toBeInTheDocument()
  })

  // Space отмечает флажок в браузере (нативная кнопка Radix) — проверяется в Playwright, jsdom его не эмулирует.
  it('moves focus between checkboxes with arrows across groups and closes with Esc back on the button', async () => {
    render(<Harness grouped />)
    const panel = await open(/Стоимость/)
    const boxes = within(panel).getAllByRole('checkbox')
    boxes[0]?.focus()
    press('ArrowDown')
    expect(boxes[1]).toHaveFocus()
    press('ArrowDown')
    press('ArrowDown')
    expect(boxes[0]).toHaveFocus()
    press('ArrowUp')
    expect(boxes[2]).toHaveFocus()
    press('Escape')
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(screen.getByRole('button', { name: 'Стоимость' })).toHaveFocus()
  })
})
