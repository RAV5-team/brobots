import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeWindowList } from './TimeWindowList'
import { addWindow, hoursOfWindows, windowHours, windowsOfHours } from './timeWindows'

const WINDOWS = [{ from: 8, to: 11 }, { from: 23, to: 2 }]

describe('окна часов — чистые функции', () => {
  it('длительность: через полночь по кругу; начало = конец — сутки', () => {
    expect(WINDOWS.map(windowHours)).toEqual([3, 3])
    expect(windowHours({ from: 5, to: 5 })).toBe(24)
  })

  it('часы окон и окна из часов — туда и обратно, склейка через полночь', () => {
    expect(hoursOfWindows(WINDOWS)).toEqual([0, 1, 8, 9, 10, 23])
    expect(windowsOfHours([0, 1, 8, 9, 10, 23])).toEqual([{ from: 8, to: 11 }, { from: 23, to: 2 }])
    expect(windowsOfHours([])).toEqual([])
    expect(hoursOfWindows(windowsOfHours(Array.from({ length: 24 }, (_, h) => h)))).toHaveLength(24)
  })

  it('новое окно — час от конца последнего; пустой список — 08:00', () => {
    expect(addWindow(WINDOWS).at(-1)).toEqual({ from: 2, to: 3 })
    expect(addWindow([])).toEqual([{ from: 8, to: 9 }])
    expect(addWindow([{ from: 22, to: 23 }]).at(-1)).toEqual({ from: 23, to: 0 })
  })
})

describe('TimeWindowList', () => {
  it('строка окна: поля начала и конца с именами, длительность, удаление; «Добавить окно»', () => {
    const onChange = vi.fn()
    render(<TimeWindowList label="Приёмка" windows={WINDOWS} onChange={onChange} />)
    const list = screen.getByRole('list', { name: 'Приёмка' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('combobox', { name: 'Приёмка: начало окна 1' })).toHaveTextContent('08:00')
    expect(screen.getByRole('combobox', { name: 'Приёмка: конец окна 2' })).toHaveTextContent('02:00')
    expect(within(list).getAllByText('3 ч')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Приёмка: удалить окно 1' }))
    expect(onChange).toHaveBeenLastCalledWith([{ from: 23, to: 2 }])
    fireEvent.click(screen.getByRole('button', { name: 'Добавить окно' }))
    expect(onChange).toHaveBeenLastCalledWith([...WINDOWS, { from: 2, to: 3 }])
  })

  it('заблокирован: поля и кнопки недоступны', () => {
    render(<TimeWindowList label="Отгрузка" windows={WINDOWS} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox', { name: 'Отгрузка: начало окна 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Отгрузка: удалить окно 2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Добавить окно' })).toBeDisabled()
  })

  it('только чтение: окна текстом, без полей и кнопок', () => {
    render(<TimeWindowList label="Приёмка" windows={WINDOWS} readOnly />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('23:00 — 02:00')).toBeInTheDocument()
  })
})
