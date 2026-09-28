import { clsx } from 'clsx'
import { useId } from 'react'
import { ChartLegend } from './ChartLegend'
import { ChartTable } from './ChartTable'
import { barBox, valueDomain } from './chartScale'
import { TONE_FILL, type ChartSeries, type ChartTone } from './chartTones'

/** Категория графика: час, год. `values` — по серии в порядке `series`. */
export interface BarDatum {
  readonly key: string
  readonly label: string
  readonly values: readonly number[]
  /** Выделенная категория: пиковый час (у одной серии — тоном выделения, у пар — подложкой колонки). */
  readonly highlight?: boolean
  /** Нарушение требования в этой категории — рамка `danger` (PRD 11.4, 07a). */
  readonly violation?: boolean
}

interface BarChartProps {
  /** Имя графика для чтения с экрана и подпись таблицы. */
  readonly label: string
  /** Заголовок колонки категорий в таблице: «Час», «Год». */
  readonly categoryLabel: string
  readonly series: readonly ChartSeries[]
  readonly data: readonly BarDatum[]
  readonly formatValue: (value: number) => string
  /** Высота области столбцов, px: 150 — потребность 05 и денежный поток 08 (16197:1603, 16197:2190). */
  readonly height?: number
  /** Тон выделенного столбца одиночной серии: пиковые часы 05 — strong. */
  readonly highlightTone?: ChartTone
  /** Значение над столбцом: денежный поток 08; отрицательное — `danger`. */
  readonly showValues?: boolean
  /** Подписи категорий под столбцами (часы 07a, годы 08). */
  readonly showCategories?: boolean
  /** Опорная линия пунктиром: «пик, на который рассчитан подбор» (05). */
  readonly reference?: { readonly value: number; readonly label: string }
  /** dense — зазор 4 и скругление 6 (часы); wide — зазор 16 и скругление 8 (годы). */
  readonly density?: 'dense' | 'wide'
  readonly legend?: boolean
}

const MIN_BAR_PX = 2
const DENSITY = {
  dense: { gap: 'gap-4', radius: 6, pairRadius: 3 },
  wide: { gap: 'gap-16', radius: 8, pairRadius: 4 },
} as const
/** Зазор между столбцами пары, доля колонки. */
const PAIR_GAP = 0.04

const pct = (share: number): string => `${String(Number((share * 100).toFixed(4)))}%`

/**
 * Столбчатый график на SVG и токенах (D-87): одна серия или пары серий по категориям, отрицательные значения
 * вниз от нулевой линии. Картинка — `role="img"` с именем; те же числа — скрытой таблицей.
 */
export function BarChart({
  label, categoryLabel, series, data, formatValue, height = 150, highlightTone, showValues = false,
  showCategories = true, reference, density = 'dense', legend = false,
}: BarChartProps) {
  const descriptionId = useId()
  const domain = valueDomain([...data.flatMap((d) => d.values), ...(reference ? [reference.value] : [])])
  const look = DENSITY[density]
  const width = (1 - PAIR_GAP * (series.length - 1)) / series.length

  return (
    <div className="flex flex-col gap-12">
      {legend && <ChartLegend series={series} />}
      <div role="img" aria-label={label} aria-describedby={reference ? descriptionId : undefined}>
        <div aria-hidden className="flex flex-col gap-8">
          {showValues && (
            <div className={clsx('flex', look.gap)}>
              {data.map((d) => (
                <span key={d.key} className={clsx('min-w-0 flex-1 text-center type-caption font-medium', (d.values[0] ?? 0) < 0 ? 'text-danger' : 'text-text')}>
                  {formatValue(d.values[0] ?? 0)}
                </span>
              ))}
            </div>
          )}
          <div className={clsx('relative flex', look.gap)} style={{ height }}>
            {data.map((d) => (
              <svg
                key={d.key}
                data-violation={d.violation ? true : undefined}
                className={clsx('min-w-0 flex-1 overflow-visible', d.violation && 'rounded-xs ring-1 ring-danger')}
                height={height}
              >
                {d.highlight && series.length > 1 && <rect data-highlight width="100%" height={height} rx={look.pairRadius} className="fill-surface-muted" />}
                {d.values.map((value, i) => {
                  const box = barBox(value, domain, height, MIN_BAR_PX)
                  const tone = series.length === 1 && d.highlight && highlightTone ? highlightTone : (series[i]?.tone ?? 'strong')
                  return (
                    <rect
                      key={series[i]?.key ?? i}
                      data-bar
                      x={pct(i * (width + PAIR_GAP))}
                      width={pct(width)}
                      y={box.top}
                      height={box.height}
                      rx={series.length === 1 ? look.radius : look.pairRadius}
                      className={TONE_FILL[value < 0 ? 'muted' : tone]}
                    />
                  )
                })}
              </svg>
            ))}
            {reference && (
              <span
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-control"
                style={{ top: barBox(reference.value, domain, height).top }}
              />
            )}
          </div>
          {showCategories && (
            <div className={clsx('flex', look.gap)}>
              {data.map((d) => <span key={d.key} className="min-w-0 flex-1 text-center type-caption-xs text-text-secondary">{d.label}</span>)}
            </div>
          )}
        </div>
        {reference && <span id={descriptionId} className="sr-only">{`${reference.label}: ${formatValue(reference.value)}`}</span>}
      </div>
      <ChartTable
        caption={label}
        categoryLabel={categoryLabel}
        columns={series.map((s) => s.label)}
        rows={data.map((d) => ({ key: d.key, label: d.label, cells: d.values.map(formatValue) }))}
      />
    </div>
  )
}
