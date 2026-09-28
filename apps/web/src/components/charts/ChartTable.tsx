import type { ReactNode } from 'react'

interface ChartTableProps {
  readonly caption: string
  /** Заголовок колонки категорий: «Час», «Год», «Параметр». */
  readonly categoryLabel: string
  readonly columns: readonly string[]
  readonly rows: readonly { readonly key: string; readonly label: ReactNode; readonly cells: readonly ReactNode[] }[]
}

/** Текстовая альтернатива графика (D-87): те же числа таблицей, видна только чтению с экрана. */
export function ChartTable({ caption, categoryLabel, columns, rows }: ChartTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{categoryLabel}</th>
          {columns.map((c) => <th key={c} scope="col">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            {row.cells.map((cell, i) => <td key={i}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
