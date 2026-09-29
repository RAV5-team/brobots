import { useCallback, useEffect, useState } from 'react'
import { ru } from '@/shared/i18n/ru'

/** Скорости воспроизведения записанного дня (PRD 11.4, 07a). */
export const PLAYBACK_SPEEDS = [120, 600, 1800] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 3_600
const SECONDS_PER_MINUTE = 60

/** Длительность словами: «12 мин», «2 мин 24 с», «48 с». */
export function durationText(totalSeconds: number): string {
  const t = ru.ui.playback
  const rounded = Math.round(totalSeconds)
  const minutes = Math.floor(rounded / SECONDS_PER_MINUTE)
  const seconds = rounded % SECONDS_PER_MINUTE
  if (minutes === 0) return t.seconds(seconds)
  return seconds === 0 ? t.minutes(minutes) : `${t.minutes(minutes)} ${t.seconds(seconds)}`
}

/** Подпись скорости по множителю (доска 16325, 17083:1232): «Сутки за 2 мин 24 с». */
export const speedLabel = (speed: number): string => ru.ui.playback.day(durationText(SECONDS_PER_DAY / speed))

/** Вторая строка опции: «1 ч суток — за 6 с». */
export const speedDescription = (speed: number): string => ru.ui.playback.hour(durationText(SECONDS_PER_HOUR / speed))

/** Опции выбора скорости — для `Select` с описанием: значение — множитель строкой. */
export const speedOptions = (): readonly { readonly value: string; readonly label: string; readonly description: string }[] =>
  PLAYBACK_SPEEDS.map((x) => ({ value: String(x), label: speedLabel(x), description: speedDescription(x) }))

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
 * На конце записи часы останавливаются. `initial` — стартовая точка на паузе (07a — начало первого пикового часа).
 * `defaultSpeed` — скорость при открытии: 07a — ×120, доска 16325 (3.5) — ×600.
 */
export function usePlaybackClock(duration: number, initial = 0, defaultSpeed: PlaybackSpeed = PLAYBACK_SPEEDS[0]): PlaybackClock {
  const [t, setT] = useState(() => Math.min(duration, Math.max(0, initial)))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(defaultSpeed)

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
