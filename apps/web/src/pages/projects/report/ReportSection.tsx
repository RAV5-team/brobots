import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'
import type { FactRow } from './reportModel'

const t = ru.report

export type ReportSectionKey = keyof typeof t.sections

interface ReportSectionProps {
  readonly n: number
  readonly sectionKey: ReportSectionKey
  readonly lead?: string
  readonly children: ReactNode
}

/**
 * Раздел отчёта (16197:2327, 16197:2328): «N. Название» 16 и линия 2 px `text` на всю ширину, отступ 28.
 * В печати каждый раздел, кроме первого, начинается с новой страницы (D-107).
 */
export function ReportSection({ n, sectionKey, lead, children }: ReportSectionProps) {
  const id = `report-${sectionKey}`
  return (
    <section aria-labelledby={id} className={clsx('flex flex-col gap-20', n > 1 && 'print:break-before-page')}>
      <h2 id={id} className="border-b-2 border-text pb-12 type-heading text-text">{t.numbered(n, t.sections[sectionKey])}</h2>
      {lead && <p className="type-body-sm text-text-secondary">{lead}</p>}
      {children}
    </section>
  )
}

/** Подзаголовок внутри раздела: «Рейтинг вариантов», «Матрица применимости». */
export function ReportSubheading({ children }: { readonly children: ReactNode }) {
  return <h3 className="pt-8 type-body font-semibold text-text">{children}</h3>
}

/** Строка шапки таблицы отчёта: заливка `surface-muted`, как у «h» таблиц макета (16197:2407). */
export function ReportHeadRow({ children }: { readonly children: ReactNode }) {
  return (
    <TableHead>
      <tr className="bg-surface-muted [&>th:first-child]:pl-10">{children}</tr>
    </TableHead>
  )
}

/** Таблица «показатель — значение»: параметры, версии, итог первой страницы. */
export function FactTable({ caption, rows, head }: { readonly caption: string; readonly rows: readonly FactRow[]; readonly head?: ReactNode }) {
  return (
    <Table caption={caption} layout="fixed">
      {head}
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="w-(--rav-report-label-width) pl-10 text-text-secondary">{row.label}</TableCell>
            <TableCell className="font-medium">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
