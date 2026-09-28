import { clsx } from 'clsx'

export interface HourlyTableCell {
  readonly value: string
  /** Требование нарушено в этот час — плашка `danger-bg`, текст `danger` и метка для чтения с экрана. */
  readonly violation?: boolean
}

export interface HourlyTableRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly HourlyTableCell[]
}

interface HourlyTableProps {
  /** Имя таблицы для чтения с экрана — видимый заголовок карточки. */
  readonly labelledBy: string
  /** Заголовок колонки подписей: «Час». */
  readonly categoryLabel: string
  /** Подписи колонок: «00» … «23». */
  readonly columns: readonly string[]
  readonly rows: readonly HourlyTableRow[]
  /** Слово для нарушения, скрытое на экране: «нарушение». */
  readonly violationLabel: string
}

/**
 * Таблица по часам (components.md: HourlyTable; 07a «Что происходило по часам», 16198:217; D-105): подпись строки 214,
 * ячейки 26 (`--rav-hour-grid-cell-height`) со скруглением 7 и зазором 2. Нарушение — розовой плашкой, не только цветом: для чтения с экрана — слово.
 */
export function HourlyTable({ labelledBy, categoryLabel, columns, rows, violationLabel }: HourlyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table aria-labelledby={labelledBy} className="w-full min-w-(--rav-hourly-table-min-width) table-fixed border-separate border-spacing-2">
        <thead>
          <tr>
            <th scope="col" className="w-(--rav-hourly-table-label-width) text-left"><span className="sr-only">{categoryLabel}</span></th>
            {columns.map((c) => <th key={c} scope="col" className="type-caption-xs font-normal text-text-secondary">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="pr-8 text-left type-caption font-normal text-text-secondary">{row.label}</th>
              {row.cells.map((cell, i) => (
                <td
                  key={columns[i] ?? i}
                  data-violation={cell.violation ? true : undefined}
                  className={clsx(
                    'h-(--rav-hour-grid-cell-height) rounded-sm text-center type-caption-xs font-medium tabular-nums',
                    cell.violation ? 'bg-danger-bg text-danger' : 'bg-surface-muted text-text-secondary',
                  )}
                >
                  {cell.value}
                  {cell.violation && <span className="sr-only">{` · ${violationLabel}`}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
