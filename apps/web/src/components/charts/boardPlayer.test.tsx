import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SimulationTrace } from '@/domain'
import { isPassed } from './chartScale'
import { PlaybackTimeline } from './PlaybackTimeline'
import { boardGroupOf, boardRobotLegend } from './robotGroups'
import { SimPlayer2D } from './SimPlayer2D'
import { durationText, speedDescription, speedLabel, speedOptions, usePlaybackClock } from './usePlaybackClock'

const trace: SimulationTrace = {
  name: '2/1', stepS: 10, robots: 4, chargers: 2, clockOffsetH: 7, states: ['idle', 'to_pickup', 'to_drop', 'wait_charger'],
  layout: {
    nodes: [{ id: 'D0', x: 0, y: -6, type: 'dock_in' }, { id: 'D1', x: 10, y: -6, type: 'dock_out' }, { id: 'S', x: 5, y: 10, type: 'storage' }, { id: 'J1', x: 10, y: 20, type: 'junction' }],
    edges: [{ from: 'D0', to: 'J1', kind: 'main' }], chargerSlots: [[12, -3], [14, -3]], width: 10, depth: 20,
  },
  frames: [{ t: 0, robots: [[0, 0, 0], [5, 5, 1], [6, 6, 2], [7, 7, 3]] }],
}

describe('SimPlayer2D look="board"', () => {
  it('ворота — пилюли с буквой, станции — ромбы, хранение не рисуется, роботы — фигуры по состоянию', () => {
    const { container } = render(
      <SimPlayer2D look="board" trace={trace} t={0} title="Из подбора: 18/5" gates={{ inbound: 'П', outbound: 'О' }} renderStats={() => null} />,
    )
    expect(screen.getByRole('img', { name: 'Из подбора: 18/5' })).toBeInTheDocument()
    expect([...container.querySelectorAll('[data-gate]')].map((g) => [g.getAttribute('data-gate'), g.textContent])).toEqual([['inbound', 'П'], ['outbound', 'О']])
    expect(container.querySelectorAll('[data-station]')).toHaveLength(2)
    expect(container.querySelector('.fill-surface-sunken')).toBeNull()
    const robots = [...container.querySelectorAll('[data-robot]')]
    expect(robots.map((r) => [r.getAttribute('data-robot'), r.tagName])).toEqual([['idle', 'circle'], ['toPickup', 'circle'], ['loaded', 'rect'], ['queue', 'circle']])
    expect(robots[0]).toHaveClass('fill-bg', 'stroke-border-control')
    expect(robots[3]).toHaveClass('fill-danger')
    expect(screen.queryByText('Приёмка')).not.toBeInTheDocument()
  })

  it('группы доски: «едет за паллетой» отдельно от «с паллетой»; неизвестное — свободен; легенда пяти знаков', () => {
    expect(boardGroupOf('to_pickup')).toBe('toPickup')
    expect(boardGroupOf('unloading')).toBe('loaded')
    expect(boardGroupOf('wait_charger')).toBe('queue')
    expect(boardGroupOf('???')).toBe('idle')
    const legend = boardRobotLegend({ idle: 'a', toPickup: 'b', loaded: 'c', station: 'd', queue: 'e' })
    expect(legend.map((l) => l.marker)).toEqual(['ring', 'ring', 'square', 'diamond', 'dot'])
  })
})

describe('скорость воспроизведения словами', () => {
  it('из множителя: сутки и час суток', () => {
    expect([120, 600, 1800].map(speedLabel)).toEqual(['Сутки за 12 мин', 'Сутки за 2 мин 24 с', 'Сутки за 48 с'])
    expect([120, 600, 1800].map(speedDescription)).toEqual(['1 ч суток — за 30 с', '1 ч суток — за 6 с', '1 ч суток — за 2 с'])
    expect(durationText(60)).toBe('1 мин')
    expect(speedOptions().map((o) => o.value)).toEqual(['120', '600', '1800'])
  })

  it('скорость по умолчанию — параметром; без него ×120', () => {
    expect(renderHook(() => usePlaybackClock(100, 0, 600)).result.current.speed).toBe(600)
    expect(renderHook(() => usePlaybackClock(100)).result.current.speed).toBe(120)
  })
})

describe('PlaybackTimeline', () => {
  it('ползунок с именем и временем словами; клавиши двигают; пройденные часы — лаймом', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PlaybackTimeline label="Время дня" valueText="08:12" max={100} step={10} value={50} onValueChange={onChange}
        bars={[1, 2, 3, 4]} ticks={[{ at: 0, label: '00' }, { at: 100, label: '24' }]} />,
    )
    const thumb = screen.getByRole('slider', { name: 'Время дня' })
    expect(thumb).toHaveAttribute('aria-valuetext', '08:12')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(60)
    fireEvent.keyDown(thumb, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(100)
    expect(container.querySelectorAll('[data-passed]')).toHaveLength(2)
    expect(screen.getByText('24')).toHaveStyle({ left: '100%' })
  })

  it('isPassed: отрезок пройден, если время дошло до его начала', () => {
    expect([0, 1, 2, 3].map((i) => isPassed(i, 4, 30, 100))).toEqual([true, true, false, false])
    expect(isPassed(0, 4, 0, 100)).toBe(false)
    expect(isPassed(0, 4, 10, 0)).toBe(false)
  })

  it('недоступна — бегунок не двигается', () => {
    const onChange = vi.fn()
    render(<PlaybackTimeline label="Время" max={100} value={0} onValueChange={onChange} bars={[1]} disabled />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
