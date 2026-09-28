import { describe, expect, it } from 'vitest'
import { toSimulationTrace } from '@/api/mappers/trace'
import { positionsAt, traceDuration } from '@/domain'
import demo166 from './traces/demo-16-5.json'
import demo186 from './traces/demo-18-6.json'

// Единственный тест, который читает настоящие трассы (1,5–1,7 МБ): остальные подставляют маленькие.
describe('2D-трассы движка — формат export_trace и связность с проектом', { timeout: 30_000 }, () => {
  const traces = [toSimulationTrace(demo186), toSimulationTrace(demo166)]

  it('составы как в фикстурах: 18/6 из подбора и 16/5 рекомендация', () => {
    expect(traces.map((t) => [t.robots, t.chargers])).toEqual([[18, 6], [16, 5]])
  })

  it('сутки от начала смены 07:00 с шагом 15 с', () => {
    for (const trace of traces) {
      expect(trace.clockOffsetH).toBe(7)
      expect(trace.stepS).toBe(15)
      expect(traceDuration(trace)).toBe((trace.frames.length - 1) * 15)
    }
  })

  it('роботы в каждом кадре — внутри схемы склада и в известных состояниях', () => {
    for (const trace of traces) {
      const xs = trace.layout.nodes.map((n) => n.x)
      const ys = trace.layout.nodes.map((n) => n.y)
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const margin = 10
      for (const frame of trace.frames) {
        for (const [x, y, state] of frame.robots) {
          expect(x >= minX - margin && x <= maxX + margin && y >= minY - margin && y <= maxY + margin).toBe(true)
          expect(trace.states[state]).toBeDefined()
        }
      }
      expect(positionsAt(trace, 3600)).toHaveLength(trace.robots)
    }
  })
})
