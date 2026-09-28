import { describe, expect, it } from 'vitest'
import { countStates, positionsAt, traceDuration, type SimulationTrace } from './simulationTrace'

const trace: SimulationTrace = {
  name: 'Из подбора: 2/1',
  stepS: 15,
  robots: 2,
  chargers: 1,
  clockOffsetH: 7,
  states: ['idle', 'to_drop', 'blocked'],
  layout: { nodes: [], edges: [], chargerSlots: [], width: 10, depth: 10 },
  frames: [
    { t: 0, robots: [[0, 0, 0], [10, 0, 1]] },
    { t: 15, robots: [[10, 0, 1], [10, 10, 2]] },
  ],
}

describe('positionsAt — позиции роботов в момент t', () => {
  it('между кадрами — линейно, состояние — из прошлого кадра', () => {
    expect(positionsAt(trace, 7.5)).toEqual([{ x: 5, y: 0, state: 'idle' }, { x: 10, y: 5, state: 'to_drop' }])
  })

  it('за пределами записи — первый и последний кадры', () => {
    expect(positionsAt(trace, -3)[0]).toEqual({ x: 0, y: 0, state: 'idle' })
    expect(positionsAt(trace, 99)[1]).toEqual({ x: 10, y: 10, state: 'blocked' })
  })
})

describe('traceDuration и countStates', () => {
  it('длительность — время последнего кадра', () => {
    expect(traceDuration(trace)).toBe(15)
  })

  it('роботы по состояниям в момент t', () => {
    expect(countStates(positionsAt(trace, 15))).toEqual({ to_drop: 1, blocked: 1 })
  })
})
