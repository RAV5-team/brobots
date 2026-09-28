import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SimulationTrace } from '@/domain'
import { Slider } from '../ui/Slider'
import { HourlyTable } from './HourlyTable'
import { groupOf, robotLegend } from './robotGroups'
import { SimPlayer2D } from './SimPlayer2D'
import { usePlaybackClock } from './usePlaybackClock'

const trace: SimulationTrace = {
  name: '2/1', stepS: 10, robots: 2, chargers: 1, clockOffsetH: 7, states: ['idle', 'to_drop', 'blocked'],
  layout: { nodes: [{ id: 'D0', x: 0, y: -6, type: 'dock_in' }, { id: 'J1', x: 10, y: 20, type: 'junction' }], edges: [{ from: 'D0', to: 'J1', kind: 'main' }], chargerSlots: [[12, -3]], width: 10, depth: 20 },
  frames: [{ t: 0, robots: [[0, 0, 0], [5, 5, 1]] }, { t: 10, robots: [[10, 0, 1], [5, 5, 2]] }],
}

describe('HourlyTable', () => {
  it('таблица с подписями часов и строк; нарушение — плашкой и словом', () => {
    render(
      <>
        <h2 id="t">Что происходило по часам</h2>
        <HourlyTable labelledBy="t" categoryLabel="Час" columns={['08', '09']} violationLabel="нарушение"
          rows={[{ key: 'u', label: 'Заняты, %', cells: [{ value: '80' }, { value: '97', violation: true }] }]} />
      </>,
    )
    const table = screen.getByRole('table', { name: 'Что происходило по часам' })
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Час', '08', '09'])
    const cells = within(table).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('97 · нарушение')
    expect(cells[1]).toHaveClass('bg-danger-bg', 'text-danger')
    expect(cells[0]).not.toHaveAttribute('data-violation')
  })
})

describe('Slider', () => {
  it('ползунок с именем и значением словами; клавиши двигают значение', () => {
    const onChange = vi.fn()
    render(<Slider label="Время дня" valueText="08:00" min={0} max={100} step={10} value={50} onValueChange={onChange} />)
    const thumb = screen.getByRole('slider', { name: 'Время дня' })
    expect(thumb).toHaveAttribute('aria-valuetext', '08:00')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(60)
    fireEvent.keyDown(thumb, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})

describe('SimPlayer2D', () => {
  it('роботы кадра в момент t — кружками по группам состояний; сводку строит вызывающий', () => {
    const { container } = render(
      <SimPlayer2D trace={trace} t={10} title="Из подбора" zones={{ inbound: 'Приёмка', outbound: 'Отгрузка', chargers: 'Зарядные станции · 1' }}
        renderStats={(byState) => <p>{JSON.stringify(byState)}</p>} />,
    )
    expect(screen.getByRole('img', { name: 'Из подбора' })).toBeInTheDocument()
    expect([...container.querySelectorAll('[data-robot]')].map((c) => c.getAttribute('data-robot'))).toEqual(['work', 'waiting'])
    expect(screen.getByText('{"to_drop":1,"blocked":1}')).toBeInTheDocument()
    expect(screen.getByText('Приёмка')).toBeInTheDocument()
    expect(screen.queryByText('Отгрузка')).not.toBeInTheDocument()
  })

  it('группы: неизвестное состояние — «свободен»; легенда по пяти группам', () => {
    expect(groupOf('unknown')).toBe('idle')
    expect(groupOf('wait_charger')).toBe('waiting')
    expect(robotLegend({ work: 'a', waiting: 'b', charging: 'c', down: 'd', idle: 'e' }).map((s) => s.tone)).toEqual(['strong', 'danger', 'accent', 'danger-soft', 'secondary'])
  })
})

describe('usePlaybackClock', () => {
  afterEach(() => { vi.useRealTimers() })

  it('старт — на паузе в начальной точке; «сначала» и перемотка в пределах записи', () => {
    const { result } = renderHook(() => usePlaybackClock(100, 40))
    expect(result.current).toMatchObject({ t: 40, playing: false, speed: 120 })
    act(() => { result.current.seek(500) })
    expect(result.current.t).toBe(100)
    act(() => { result.current.toStart() })
    expect(result.current.t).toBe(0)
  })

  it('пуск в конце записи начинает с начала', () => {
    const { result } = renderHook(() => usePlaybackClock(100, 100))
    act(() => { result.current.play() })
    expect(result.current).toMatchObject({ t: 0, playing: true })
  })
})
