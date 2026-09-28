import { clsx } from 'clsx'
import { TONE_BORDER, TONE_SWATCH, type ChartSeries, type ChartTone } from './chartTones'

/**
 * Знак пункта легенды. square — квадрат 12 r3 (графики, 16198:697); dot — круг 10 (роботы 2D-плеера, 16198:835).
 * Доска 16325 (3.5): ring — круг-обводка (робот свободен / едет за паллетой), diamond — ромб (зарядная станция),
 * dash — черта (пиковый час), frame — квадрат-рамка (нарушение требования).
 */
export type LegendMarker = 'square' | 'dot' | 'ring' | 'diamond' | 'dash' | 'frame'

/** Пункт легенды: серия графика, по желанию — вторая строка-итог и свой знак. */
export interface LegendItem extends ChartSeries {
  /** Вторая строка под подписью: «в пик 107 из 130 рейсов» (3.5). */
  readonly detail?: string
  /** Знак этого пункта вместо общего `shape`. */
  readonly marker?: LegendMarker
}

interface ChartLegendProps {
  readonly series: readonly LegendItem[]
  /** Знак по умолчанию для всех пунктов. */
  readonly shape?: LegendMarker
  /** row — пункты в строку с переносом; column — колонкой (легенда слева от графика, 3.5). */
  readonly layout?: 'row' | 'column'
  readonly className?: string | undefined
}

const OUTLINE = 'border-(length:--rav-border-width-control)'

const MARKER: Record<LegendMarker, (tone: ChartTone) => string> = {
  square: (tone) => clsx('size-12 rounded-xs', TONE_SWATCH[tone]),
  dot: (tone) => clsx('size-10 rounded-full', TONE_SWATCH[tone]),
  ring: (tone) => clsx('size-10 rounded-full', OUTLINE, TONE_BORDER[tone]),
  diamond: (tone) => clsx('size-8 rotate-45', TONE_SWATCH[tone]),
  dash: (tone) => clsx('h-4 w-12 rounded-full', TONE_SWATCH[tone]),
  frame: (tone) => clsx('size-12 rounded-xs', OUTLINE, TONE_BORDER[tone]),
}

/** Легенда: знак и подпись 12. Для чтения с экрана — таблица графика или сводка плеера, легенда скрыта. */
export function ChartLegend({ series, shape = 'square', layout = 'row', className }: ChartLegendProps) {
  return (
    <ul aria-hidden className={clsx(layout === 'row' ? 'flex flex-wrap gap-x-16 gap-y-8' : 'flex flex-col gap-10', className)}>
      {series.map((s) => {
        const marker = <span data-marker={s.marker} className={clsx('shrink-0', MARKER[s.marker ?? shape](s.tone))} />
        if (s.detail === undefined) {
          return (
            <li key={s.key} className="flex items-center gap-6 type-caption text-text-secondary">
              {marker}
              {s.label}
            </li>
          )
        }
        return (
          <li key={s.key} className="flex items-start gap-6 type-caption">
            <span className="flex h-16 shrink-0 items-center">{marker}</span>
            <span className="flex flex-col">
              <span className="text-text">{s.label}</span>
              <span className="text-text-muted">{s.detail}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
