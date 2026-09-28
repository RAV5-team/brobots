/** Кадр дольше этого — ниже 30 кадров в секунду (критерий спайка, D-87). */
export const LONG_FRAME_MS = 1000 / 30

export interface FrameStats {
  readonly fps: number
  readonly frames: number
  /** 95-й перцентиль длительности кадра, мс. */
  readonly p95FrameMs: number
  /** Кадров дольше LONG_FRAME_MS. */
  readonly longFrames: number
}

/** Статистика по отметкам времени кадров (performance.now из requestAnimationFrame). */
export function frameStats(stamps: readonly number[]): FrameStats {
  if (stamps.length < 2) return { fps: 0, frames: 0, p95FrameMs: 0, longFrames: 0 }
  const durations = stamps.slice(1).map((t, i) => t - (stamps[i] ?? t))
  const sorted = [...durations].sort((a, b) => a - b)
  const total = (stamps.at(-1) ?? 0) - (stamps[0] ?? 0)
  return {
    fps: durations.length / (total / 1000),
    frames: durations.length,
    p95FrameMs: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    longFrames: durations.filter((d) => d > LONG_FRAME_MS + 1).length,
  }
}

/** Отметки кадров за `durationMs` — через requestAnimationFrame, как их видит пользователь. */
export function recordFrames(durationMs: number): Promise<readonly number[]> {
  return new Promise((resolve) => {
    const stamps: number[] = []
    const tick = (now: number) => {
      stamps.push(now)
      if (now - (stamps[0] ?? now) < durationMs) requestAnimationFrame(tick)
      else resolve(stamps)
    }
    requestAnimationFrame(tick)
  })
}
