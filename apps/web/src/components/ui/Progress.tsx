import { clsx } from 'clsx'

/**
 * sunken — дорожка на фоне страницы; strong — на утопленной плашке, где sunken сливается с фоном (А1а, 16044:378);
 * inverse — на тёмной карточке прогона (06, 16197:1754; D-103).
 */
export type ProgressTrack = 'sunken' | 'strong' | 'inverse'

interface ProgressProps {
  /** Что выполняется: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
  readonly track?: ProgressTrack
  /** accent — лаймовая заливка (16044:378); inverse — тёмная, готовность профиля (15950:2163). */
  readonly tone?: 'accent' | 'inverse'
}

const TRACKS: Record<ProgressTrack, string> = { sunken: 'bg-surface-sunken', strong: 'bg-border', inverse: 'bg-inverse-well' }

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/** Полоса выполнения 6 px (components.md: Progress; 16044:378, 15950:2163). Долгие операции показывают статус (ТЗ 4.3.3). */
export function Progress({ label, value, track = 'sunken', tone = 'accent' }: ProgressProps) {
  const percent = clamp(value)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={clsx('h-6 w-full overflow-hidden rounded-full', TRACKS[track])}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', tone === 'accent' ? 'bg-accent' : 'bg-inverse')}
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  )
}
