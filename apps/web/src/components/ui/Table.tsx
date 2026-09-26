import { clsx } from 'clsx'
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/** Таблица данных (components.md: Table row / cell; строка 37 px — отступ 8 + текст 20 + разделитель, 15997:402). */
interface TableProps {
  readonly caption: string
  readonly children: ReactNode
  /** fixed — ширины колонок задают ячейки шапки, а не содержимое (таблица исполнителей 09а). */
  readonly layout?: 'auto' | 'fixed'
}

export function Table({ caption, children, layout = 'auto' }: TableProps) {
  return (
    <table className={clsx('w-full border-collapse text-left', layout === 'fixed' && 'table-fixed')}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  )
}

export function TableHead({ children }: { readonly children: ReactNode }) {
  return <thead>{children}</thead>
}

export function TableBody({ children }: { readonly children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TableRow({ children, selected = false }: { readonly children: ReactNode; readonly selected?: boolean }) {
  return (
    <tr aria-selected={selected || undefined} className={clsx('border-b border-border transition-colors hover:bg-surface-muted', selected && 'bg-surface-sunken')}>
      {children}
    </tr>
  )
}

type Align = 'start' | 'end'
const ALIGN: Record<Align, string> = { start: 'text-left', end: 'text-right' }

type HeaderTone = 'overline' | 'label'
// overline — капсом (А5, 15997:402); label — обычная подпись поля (таблица исполнителей 09а, 15935:1132).
const HEADER_TONE: Record<HeaderTone, string> = {
  overline: 'type-overline font-medium text-text-muted',
  label: 'type-caption font-medium text-text-secondary',
}

interface TableHeaderCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  readonly align?: Align
  readonly tone?: HeaderTone
}

export function TableHeaderCell({ align = 'start', tone = 'overline', className, ...rest }: TableHeaderCellProps) {
  return <th scope="col" className={clsx('py-8 pr-12 align-top last:pr-0', HEADER_TONE[tone], ALIGN[align], className)} {...rest} />
}

export function TableCell({ align = 'start', className, ...rest }: Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> & { readonly align?: Align }) {
  return <td className={clsx('py-8 pr-12 align-middle type-body text-text last:pr-0', ALIGN[align], className)} {...rest} />
}
