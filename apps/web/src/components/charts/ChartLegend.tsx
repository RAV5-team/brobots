import { clsx } from 'clsx'
import { TONE_SWATCH, type ChartSeries } from './chartTones'

/** Легенда: квадрат 12 r3 и подпись 12 (16198:697). Для чтения с экрана — таблица графика, легенда скрыта. */
export function ChartLegend({ series, className }: { readonly series: readonly ChartSeries[]; readonly className?: string }) {
  return (
    <ul aria-hidden className={clsx('flex flex-wrap gap-x-16 gap-y-8', className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-6 type-caption text-text-secondary">
          <span className={clsx('size-12 shrink-0 rounded-xs', TONE_SWATCH[s.tone])} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}
