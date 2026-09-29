import { clsx } from 'clsx'
import { useState } from 'react'
import { TextButton } from '../ui/TextLink'
import { filterDiffering, type HourlyTableGroup, type HourlyTableMetric } from './hourlyDiff'

export type { HourlyTableGroup, HourlyTableMetric } from './hourlyDiff'

export interface HourlyTableCell {
  readonly value: string
  /** Требование нарушено в этот час — плашка `danger-bg` (или рамка при `violation="outline"`) и метка для чтения с экрана. */
  readonly violation?: boolean
}

export interface HourlyTableRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly HourlyTableCell[]
}

/** Кнопка под таблицей «Показать все строки · N» / «Только различия» (3.5, proposed): подписи — от экрана. */
export interface HourlyTableToggle {
  readonly showAll: (hidden: number) => string
  readonly onlyDiffering: string
}

interface HourlyTableProps {
  /** Имя таблицы для чтения с экрана — видимый заголовок карточки. */
  readonly labelledBy: string
  /** Заголовок колонки подписей: «Час». */
  readonly categoryLabel: string
  /** Подписи колонок: «00» … «23». */
  readonly columns: readonly string[]
  /** Строки без группы — сверху: «Потребность, рейсов». */
  readonly rows: readonly HourlyTableRow[]
  /** Слово для нарушения, скрытое на экране: «нарушение». */
  readonly violationLabel: string
  /** Группы показателей под строками (3.5): «Нагрузка на парк», «Результат»; у показателя — строки по составам. */
  readonly groups?: readonly HourlyTableGroup[]
  /** fill — плашка `danger-bg` на серой ячейке (07a); outline — ячейки без подложки, нарушение красной рамкой (3.5). */
  readonly violation?: 'fill' | 'outline'
  /** Скрыть показатели групп, у которых строки составов совпадают (3.5). Начальное значение, если есть `toggle`. */
  readonly onlyDiffering?: boolean
  /** Кнопка под таблицей переключает «только различия» / «все строки». */
  readonly toggle?: HourlyTableToggle
}

const cellClass = (violated: boolean | undefined, look: 'fill' | 'outline') =>
  look === 'fill'
    ? clsx('h-(--rav-hour-grid-cell-height) rounded-sm text-center type-caption-xs font-medium tabular-nums', violated ? 'bg-danger-bg text-danger' : 'bg-surface-muted text-text-secondary')
    : clsx('h-(--rav-hour-grid-cell-height) rounded-xs text-center type-caption-xs font-medium tabular-nums', violated ? 'text-danger ring-1 ring-danger-border ring-inset' : 'text-text-secondary')

function Cells({ row, columns, look, violationLabel }: { readonly row: HourlyTableRow; readonly columns: readonly string[]; readonly look: 'fill' | 'outline'; readonly violationLabel: string }) {
  return row.cells.map((cell, i) => (
    <td key={columns[i] ?? i} data-violation={cell.violation ? true : undefined} className={cellClass(cell.violation, look)}>
      {cell.value}
      {cell.violation && <span className="sr-only">{` · ${violationLabel}`}</span>}
    </td>
  ))
}

function MetricRows({ metric, columns, look, violationLabel }: { readonly metric: HourlyTableMetric; readonly columns: readonly string[]; readonly look: 'fill' | 'outline'; readonly violationLabel: string }) {
  return (
    <>
      <tr data-metric={metric.key}>
        <th scope="colgroup" colSpan={columns.length + 1} className="pt-6 text-left font-normal">
          <span className="type-overline text-text-muted">{metric.label}</span>
          {metric.requirement && <span className="pl-8 type-caption-xs text-text-muted">{metric.requirement}</span>}
        </th>
      </tr>
      {metric.rows.map((row) => (
        <tr key={row.key}>
          <th scope="row" className="pr-8 text-left type-caption font-normal text-text-secondary">
            <span className="sr-only">{`${metric.label}: ${row.label}`}</span>
            <span aria-hidden>{row.label}</span>
          </th>
          <Cells row={row} columns={columns} look={look} violationLabel={violationLabel} />
        </tr>
      ))}
    </>
  )
}

/**
 * Таблица по часам (components.md: HourlyTable; 07a «Что происходило по часам», 16198:217; D-105): подпись строки 214,
 * ячейки 26 (`--rav-hour-grid-cell-height`) со скруглением 7 и зазором 2. Нарушение — розовой плашкой, не только цветом: для чтения с экрана — слово.
 * Доска 16325 (3.5): группы показателей с подписью-требованием, строки по составам, нарушение рамкой, фильтр различий.
 */
export function HourlyTable({ labelledBy, categoryLabel, columns, rows, violationLabel, groups, violation = 'fill', onlyDiffering = false, toggle }: HourlyTableProps) {
  const [filtered, setFiltered] = useState(onlyDiffering)
  const view = groups ? filterDiffering(groups, filtered) : null
  const table = (
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
              <Cells row={row} columns={columns} look={violation} violationLabel={violationLabel} />
            </tr>
          ))}
        </tbody>
        {view?.groups.map((group) => (
          <tbody key={group.key} data-group={group.key}>
            <tr>
              <th scope="colgroup" colSpan={columns.length + 1} className="pt-12 text-left type-caption font-semibold text-text">{group.title}</th>
            </tr>
            {group.metrics.map((metric) => <MetricRows key={metric.key} metric={metric} columns={columns} look={violation} violationLabel={violationLabel} />)}
          </tbody>
        ))}
      </table>
    </div>
  )
  if (!toggle || !view || view.hidden === 0) return table
  return (
    <div className="flex flex-col gap-8">
      {table}
      <TextButton variant="subtle" className="self-start" onClick={() => { setFiltered((f) => !f) }}>
        {filtered ? toggle.showAll(view.hidden) : toggle.onlyDiffering}
      </TextButton>
    </div>
  )
}
