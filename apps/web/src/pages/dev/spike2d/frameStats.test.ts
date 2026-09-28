import { describe, expect, it } from 'vitest'
import { frameStats } from './frameStats'

describe('frameStats — частота кадров по отметкам requestAnimationFrame', () => {
  it('ровные 60 кадров в секунду', () => {
    const stamps = Array.from({ length: 61 }, (_, i) => i * (1000 / 60))
    const stats = frameStats(stamps)
    expect(stats.fps).toBeCloseTo(60, 6)
    expect(stats).toMatchObject({ frames: 60, longFrames: 0 })
  })

  it('длинные кадры (> 33 мс) считаются, p95 — по длительности кадров', () => {
    const stamps = [0, 16, 32, 82, 98, 114]
    const stats = frameStats(stamps)
    expect(stats.longFrames).toBe(1)
    expect(stats.p95FrameMs).toBe(50)
    expect(stats.fps).toBeCloseTo(5 / 0.114, 5)
  })

  it('меньше двух отметок — нули', () => {
    expect(frameStats([5])).toEqual({ fps: 0, frames: 0, p95FrameMs: 0, longFrames: 0 })
  })
})
