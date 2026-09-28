import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'
import type { ValueRow } from './paramsModel'

const t = ru.project.params

interface ValueTableProps {
  readonly title: string
  readonly rows: readonly ValueRow[]
  /** Подпись под «нет данных»: ссылка в профиль локации или процесса. */
  readonly missingAction?: (row: ValueRow) => ReactNode
}

/**
 * Группа значений шага 1 только для чтения: параметр · значение · статус (PRD 11.2; группы А–Г и параметры площадки).
 * Строка с якорем — цель «↓» из плашки незаполненных значений.
 */
export function ValueTable({ title, rows, missingAction }: ValueTableProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h3 className="type-overline font-medium text-text-muted">{title}</h3>
      <Table caption={title} layout="fixed" density="regular">
        <TableHead>
          <tr className="border-b border-border">
            <TableHeaderCell className="w-(--rav-params-label-width)">{t.columns.param}</TableHeaderCell>
            <TableHeaderCell>{t.columns.value}</TableHeaderCell>
            <TableHeaderCell className="w-(--rav-params-status-width)">{t.columns.status}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="text-text-secondary" {...(row.anchor ? { id: row.anchor } : {})}>{row.label}</TableCell>
              <TableCell>
                <span className="flex flex-col gap-2">
                  <span className={row.value === null ? 'text-text-muted' : 'font-medium'}>{row.value ?? t.rows.noData}</span>
                  {row.note && (row.value === null && missingAction
                    ? missingAction(row)
                    : <span className="type-caption text-text-secondary">{row.note}</span>)}
                </span>
              </TableCell>
              <TableCell><Badge kind={row.origin} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
