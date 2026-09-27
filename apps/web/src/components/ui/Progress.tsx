import { clsx } from 'clsx'

/** sunken — дорожка на фоне страницы; strong — на утопленной плашке, где sunken сливается с фоном (А1а, 16044:378). */
export type ProgressTrack = 'sunken' | 'strong'

interface ProgressProps {
  /** Что выполняется: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
  readonly track?: ProgressTrack
}

const TRACKS: Record<ProgressTrack, string> = { sunken: 'bg-surface-sunken', strong: 'bg-border' }

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/** Полоса выполнения 6 px (components.md: Progress; 16044:378). Долгие операции показывают статус (ТЗ 4.3.3). */
export function Progress({ label, value, track = 'sunken' }: ProgressProps) {
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
      <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${String(percent)}%` }} />
    </div>
  )
}
