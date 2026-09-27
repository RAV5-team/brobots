import { clsx } from 'clsx'

interface ProgressProps {
  /** Что выполняется: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
  /** accent — лаймовая заливка (16044:378); inverse — тёмная, готовность профиля (15950:2163). */
  readonly tone?: 'accent' | 'inverse'
}

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/** Полоса выполнения 6 px (components.md: Progress; 16044:378, 15950:2163). Долгие операции показывают статус (ТЗ 4.3.3). */
export function Progress({ label, value, tone = 'accent' }: ProgressProps) {
  const percent = clamp(value)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-6 w-full overflow-hidden rounded-full bg-surface-sunken"
    >
      <div className={clsx('h-full rounded-full transition-[width] duration-300', tone === 'accent' ? 'bg-accent' : 'bg-inverse')} style={{ width: `${String(percent)}%` }} />
    </div>
  )
}
