import { useCallback, useEffect, useState } from 'react'

/** Скорости воспроизведения записанного дня (PRD 11.4, 07a). */
export const PLAYBACK_SPEEDS = [120, 600, 1800] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface PlaybackClock {
  /** Время записи, с. */
  readonly t: number
  readonly playing: boolean
  readonly speed: PlaybackSpeed
  readonly play: () => void
  readonly pause: () => void
  readonly toStart: () => void
  readonly seek: (t: number) => void
  readonly setSpeed: (speed: PlaybackSpeed) => void
}

/**
 * Общие часы плееров: время двигает requestAnimationFrame — секунда реального времени × скорость.
 * На конце записи часы останавливаются.
 */
export function usePlaybackClock(duration: number): PlaybackClock {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(PLAYBACK_SPEEDS[0])

  useEffect(() => {
    if (!playing) return undefined
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed
      last = now
      setT((prev) => {
        const next = Math.min(duration, prev + dt)
        if (next >= duration) setPlaying(false)
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame) }
  }, [playing, speed, duration])

  const play = useCallback(() => {
    setT((prev) => (prev >= duration ? 0 : prev))
    setPlaying(true)
  }, [duration])
  const pause = useCallback(() => { setPlaying(false) }, [])
  const toStart = useCallback(() => { setT(0) }, [])
  const seek = useCallback((next: number) => { setT(Math.min(duration, Math.max(0, next))) }, [duration])

  return { t, playing, speed, play, pause, toStart, seek, setSpeed }
}
