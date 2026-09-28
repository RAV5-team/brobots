import { clsx } from 'clsx'
import { TONE_SWATCH, type ChartSeries } from './chartTones'

interface ChartLegendProps {
  readonly series: readonly ChartSeries[]
  /** square — квадрат 12 r3 (графики, 16198:697); dot — круг 10 (роботы 2D-плеера, 16198:835). */
  readonly shape?: 'square' | 'dot'
  readonly className?: string
}

/** Легенда: знак и подпись 12. Для чтения с экрана — таблица графика или сводка плеера, легенда скрыта. */
export function ChartLegend({ series, shape = 'square', className }: ChartLegendProps) {
  return (
    <ul aria-hidden className={clsx('flex flex-wrap gap-x-16 gap-y-8', className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-6 type-caption text-text-secondary">
          <span className={clsx('shrink-0', shape === 'square' ? 'size-12 rounded-xs' : 'size-10 rounded-full', TONE_SWATCH[s.tone])} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}
