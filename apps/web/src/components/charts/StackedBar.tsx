import { ChartLegend } from './ChartLegend'
import { ChartTable } from './ChartTable'
import { shares } from './chartScale'
import { TONE_FILL, type ChartSeries } from './chartTones'

export interface StackedRow {
  readonly key: string
  /** Подпись над полосой: «Из подбора: 18 роботов, 6 станций — в рейсе 39 % времени». */
  readonly label: string
  /** Значение по ключу сегмента; полоса — доли от суммы. */
  readonly values: Readonly<Record<string, number>>
}

interface StackedBarProps {
  readonly label: string
  readonly segments: readonly ChartSeries[]
  readonly rows: readonly StackedRow[]
  readonly formatShare: (share: number) => string
}

const pct = (share: number): string => `${String(Number((share * 100).toFixed(4)))}%`

/**
 * Полосы 100 % на SVG (D-87): «На что уходит время робота» (07a, 16198:677) — подпись, полоса 22 со скруглением,
 * общая легенда. Те же доли — скрытой таблицей.
 */
export function StackedBar({ label, segments, rows, formatShare }: StackedBarProps) {
  const rowShares = rows.map((row) => shares(segments.map((s) => row.values[s.key] ?? 0)))
  return (
    <div className="flex flex-col gap-14">
      <div role="img" aria-label={label} className="flex flex-col gap-14">
        {rows.map((row, r) => {
          const parts = rowShares[r] ?? []
          const starts = parts.map((_, i) => parts.slice(0, i).reduce((sum, v) => sum + v, 0))
          return (
            <div key={row.key} aria-hidden className="flex flex-col gap-8">
              <p className="type-body-sm text-text-secondary">{row.label}</p>
              <svg className="w-full overflow-hidden rounded-full" height={22}>
                {segments.map((s, i) => (
                  <rect key={s.key} data-segment x={pct(starts[i] ?? 0)} width={pct(parts[i] ?? 0)} height="100%" className={TONE_FILL[s.tone]} />
                ))}
              </svg>
            </div>
          )
        })}
      </div>
      <ChartLegend series={segments} />
      <ChartTable
        caption={label}
        categoryLabel={label}
        columns={segments.map((s) => s.label)}
        rows={rows.map((row, r) => ({ key: row.key, label: row.label, cells: (rowShares[r] ?? []).map(formatShare) }))}
      />
    </div>
  )
}
