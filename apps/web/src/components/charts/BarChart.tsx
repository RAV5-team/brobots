import { clsx } from 'clsx'
import { Fragment, useId, type ReactNode } from 'react'
import { ChartLegend, type LegendItem } from './ChartLegend'
import { ChartTable } from './ChartTable'
import { barBox, stackBoxes, valueDomain, type ValueDomain } from './chartScale'
import { TONE_FILL, type ChartSeries, type ChartTone } from './chartTones'

/** Категория графика: час, год. `values` — по серии в порядке `series`. */
export interface BarDatum {
  readonly key: string
  readonly label: string
  readonly values: readonly number[]
  /** Выделенная категория: пиковый час (у одной серии — тоном выделения, у пар — подложкой колонки, при `peakMark` — чертой). */
  readonly highlight?: boolean
  /** Нарушение требования в этой категории — рамка `danger` (PRD 11.4, 07a). */
  readonly violation?: boolean
  /** Подпись под столбцом, если отличается от `label`: '' — без подписи (3.2 подписывает каждый шестой час). Таблица — по `label`. */
  readonly axisLabel?: string
}

/** Ось значений слева (3.5): отметки и подпись единицы над осью. */
export interface BarAxis {
  readonly ticks: readonly number[]
  /** «рейсов в час». */
  readonly unit?: string
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
  /** Опорная линия пунктиром: «пик, на который рассчитан подбор» (05); `tone: 'danger'` — красный пунктир (3.2). */
  readonly reference?: { readonly value: number; readonly label: string; readonly tone?: 'neutral' | 'danger' }
  /** dense — зазор 4 и скругление 6 (часы); wide — зазор 16 и скругление 8 (годы). */
  readonly density?: 'dense' | 'wide'
  readonly legend?: boolean
  /** Серии стопкой в одном столбце, первая — снизу: «приёмка + отгрузка» (3.2). */
  readonly stacked?: boolean
  /** Ось значений с подписями слева (3.5). */
  readonly axis?: BarAxis
  /** Выделенная категория — чертой под столбцами вместо подложки или тона (пиковый час 3.5). */
  readonly peakMark?: boolean
  /** top — легенда над графиком (по умолчанию); left — колонкой слева (3.5). */
  readonly legendPosition?: 'top' | 'left'
  /** Пункты легенды вместо серий: итог второй строкой, «Пиковый час», «Красная рамка» (3.5). */
  readonly legendItems?: readonly LegendItem[]
}

const MIN_BAR_PX = 2
const DENSITY = {
  dense: { gap: 'gap-4', radius: 6, pairRadius: 3 },
  wide: { gap: 'gap-16', radius: 8, pairRadius: 4 },
} as const
/** Зазор между столбцами пары, доля колонки. */
const PAIR_GAP = 0.04

const pct = (share: number): string => `${String(Number((share * 100).toFixed(4)))}%`

type Look = (typeof DENSITY)[keyof typeof DENSITY]

interface ColumnProps {
  readonly datum: BarDatum
  readonly series: readonly ChartSeries[]
  readonly domain: ValueDomain
  readonly height: number
  readonly look: Look
  readonly highlightTone: ChartTone | undefined
  readonly stacked: boolean
  readonly peakMark: boolean
}

/** Колонка категории: столбцы серий рядом или стопкой, подложка выделения, рамка нарушения. */
function Column({ datum: d, series, domain, height, look, highlightTone, stacked, peakMark }: ColumnProps) {
  const width = (1 - PAIR_GAP * (series.length - 1)) / series.length
  const boxes = stacked ? stackBoxes(d.values, domain, height) : null
  return (
    <svg
      data-violation={d.violation ? true : undefined}
      className={clsx('min-w-0 flex-1 overflow-visible', d.violation && 'rounded-xs ring-1 ring-danger')}
      height={height}
    >
      {d.highlight && series.length > 1 && !peakMark && <rect data-highlight width="100%" height={height} rx={look.pairRadius} className="fill-surface-muted" />}
      {d.values.map((value, i) => {
        const tone = series.length === 1 && d.highlight && highlightTone && !peakMark ? highlightTone : (series[i]?.tone ?? 'strong')
        if (boxes) {
          const box = boxes[i]
          if (!box || box.height === 0) return null
          return <rect key={series[i]?.key ?? i} data-bar width="100%" y={box.top} height={box.height} rx={look.pairRadius} className={TONE_FILL[tone]} />
        }
        const box = barBox(value, domain, height, MIN_BAR_PX)
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
  )
}

/** Подписи оси значений: по отметке у её высоты; ширину колонки задаёт невидимый столбик тех же подписей. */
function AxisLabels({ axis, domain, height, formatValue }: { readonly axis: BarAxis; readonly domain: ValueDomain; readonly height: number; readonly formatValue: (v: number) => string }) {
  return (
    <span className="relative block shrink-0" style={{ height }}>
      <span className="invisible block h-0 overflow-hidden">
        {axis.ticks.map((tick) => <span key={tick} className="block type-caption-xs tabular-nums">{formatValue(tick)}</span>)}
      </span>
      {axis.ticks.map((tick) => (
        <span
          key={tick}
          data-axis-tick
          className="absolute right-0 -translate-y-1/2 type-caption-xs text-text-muted tabular-nums"
          style={{ top: barBox(tick, domain, height).top }}
        >
          {formatValue(tick)}
        </span>
      ))}
    </span>
  )
}

/**
 * Столбчатый график на SVG и токенах (D-87): одна серия или пары серий по категориям, отрицательные значения
 * вниз от нулевой линии; по флагам — стопка, ось значений, черта пика, легенда слева (доска 16325, 3.2 и 3.5).
 * Картинка — `role="img"` с именем; те же числа — скрытой таблицей.
 */
export function BarChart({
  label, categoryLabel, series, data, formatValue, height = 150, highlightTone, showValues = false,
  showCategories = true, reference, density = 'dense', legend = false, stacked = false, axis, peakMark = false,
  legendPosition = 'top', legendItems,
}: BarChartProps) {
  const descriptionId = useId()
  const plotted = stacked ? data.map((d) => d.values.reduce((sum, v) => sum + Math.max(0, v), 0)) : data.flatMap((d) => d.values)
  const domain = valueDomain([...plotted, ...(reference ? [reference.value] : []), ...(axis?.ticks ?? [])])
  const look = DENSITY[density]
  const legendLeft = legend && legendPosition === 'left'

  const rows: { readonly key: string; readonly axisCell?: ReactNode; readonly node: ReactNode }[] = [
    // Единица над осью — вправо от края колонки подписей, колонку не расширяет.
    ...(axis?.unit ? [{
      key: 'unit',
      axisCell: <span className="relative block h-16"><span className="absolute right-0 type-caption-xs whitespace-nowrap text-text-muted">{axis.unit}</span></span>,
      node: null,
    }] : []),
    ...(showValues ? [{
      key: 'values',
      node: (
        <div className={clsx('flex', look.gap)}>
          {data.map((d) => {
            // В стопке подпись — высота всего столбца, а не нижнего сегмента.
            const shown = stacked ? d.values.reduce((sum, v) => sum + Math.max(0, v), 0) : (d.values[0] ?? 0)
            return (
              <span key={d.key} className={clsx('min-w-0 flex-1 text-center type-caption font-medium', shown < 0 ? 'text-danger' : 'text-text')}>
                {formatValue(shown)}
              </span>
            )
          })}
        </div>
      ),
    }] : []),
    {
      key: 'bars',
      axisCell: axis && <AxisLabels axis={axis} domain={domain} height={height} formatValue={formatValue} />,
      node: (
        <div className={clsx('relative flex', look.gap)} style={{ height }}>
          {data.map((d) => (
            <Column key={d.key} datum={d} series={series} domain={domain} height={height} look={look} highlightTone={highlightTone} stacked={stacked} peakMark={peakMark} />
          ))}
          {reference && (
            <span
              data-reference={reference.tone === 'danger' ? 'danger' : undefined}
              className={clsx('pointer-events-none absolute inset-x-0 border-t border-dashed', reference.tone === 'danger' ? 'border-danger' : 'border-border-control')}
              style={{ top: barBox(reference.value, domain, height).top }}
            />
          )}
        </div>
      ),
    },
    ...(peakMark ? [{
      key: 'peaks',
      node: (
        <div className={clsx('-mt-4 flex', look.gap)}>
          {data.map((d) => <span key={d.key} data-peak={d.highlight ? true : undefined} className={clsx('h-4 min-w-0 flex-1 rounded-full', d.highlight && 'bg-inverse')} />)}
        </div>
      ),
    }] : []),
    ...(showCategories ? [{
      key: 'categories',
      node: (
        <div className={clsx('flex', look.gap)}>
          {data.map((d) => <span key={d.key} className="min-w-0 flex-1 text-center type-caption-xs text-text-secondary">{d.axisLabel ?? d.label}</span>)}
        </div>
      ),
    }] : []),
  ]

  const picture = (
    <div role="img" aria-label={label} aria-describedby={reference ? descriptionId : undefined} className={legendLeft ? 'min-w-0 flex-1' : undefined}>
      {axis ? (
        <div aria-hidden className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-8">
          {rows.map((row) => [
            <span key={`${row.key}-axis`}>{row.axisCell}</span>,
            <div key={row.key} className="min-w-0">{row.node}</div>,
          ])}
        </div>
      ) : (
        <div aria-hidden className="flex flex-col gap-8">
          {rows.map((row) => <Fragment key={row.key}>{row.node}</Fragment>)}
        </div>
      )}
      {reference && <span id={descriptionId} className="sr-only">{`${reference.label}: ${formatValue(reference.value)}`}</span>}
    </div>
  )
  const legendNode = legend && <ChartLegend series={legendItems ?? series} layout={legendLeft ? 'column' : 'row'} className={legendLeft ? 'shrink-0' : undefined} />

  return (
    <div className="flex flex-col gap-12">
      {legendLeft ? <div className="flex items-start gap-24">{legendNode}{picture}</div> : <>{legendNode}{picture}</>}
      <ChartTable
        caption={label}
        categoryLabel={categoryLabel}
        columns={series.map((s) => s.label)}
        rows={data.map((d) => ({ key: d.key, label: d.label, cells: d.values.map(formatValue) }))}
      />
    </div>
  )
}
