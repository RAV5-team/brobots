import { ChartTable } from './ChartTable'
import { rangeBox } from './chartScale'

export interface RangeRow {
  readonly key: string
  readonly label: string
  readonly from: number
  readonly to: number
  /** Диапазон словами: «0,4 — 1,1 года». */
  readonly valueText: string
}

interface RangeBarProps {
  readonly label: string
  /** Заголовок колонки значений таблицы: «Окупаемость, лет». */
  readonly valueLabel: string
  readonly rows: readonly RangeRow[]
}

const pct = (share: number): string => `${String(Number((share * 100).toFixed(4)))}%`

/**
 * Диапазоны на общей шкале 0…max (D-87): «Устойчивость: окупаемость при ±20 %» (08, 16197:2216) —
 * подпись, дорожка 12 и отрезок от минимума до максимума, значение справа. Те же числа — скрытой таблицей.
 */
export function RangeBar({ label, valueLabel, rows }: RangeBarProps) {
  const max = Math.max(...rows.map((r) => Math.max(r.from, r.to)), Number.EPSILON)
  return (
    <div className="flex flex-col gap-12">
      <div role="img" aria-label={label} className="flex flex-col gap-12">
        {rows.map((row) => {
          const box = rangeBox(row.from, row.to, max)
          return (
            <div key={row.key} aria-hidden className="flex items-center gap-16">
              <span className="w-(--rav-chart-row-label-width) shrink-0 type-body-sm text-text-secondary">{row.label}</span>
              <svg className="h-12 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken" height={12}>
                <rect data-range x={pct(box.start)} width={pct(box.width)} height="100%" rx={6} className="fill-inverse" />
              </svg>
              <span className="w-(--rav-chart-row-value-width) shrink-0 text-right type-body-sm font-medium text-text">{row.valueText}</span>
            </div>
          )
        })}
      </div>
      <ChartTable caption={label} categoryLabel={label} columns={[valueLabel]} rows={rows.map((row) => ({ key: row.key, label: row.label, cells: [row.valueText] }))} />
    </div>
  )
}
