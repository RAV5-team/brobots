import { clsx } from 'clsx'
import { createContext, use, type MouseEvent, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'

/**
 * compact — строка 37 px: отступ 8 + текст 20 + разделитель, ячейки по центру (15997:402);
 * regular — строки из двух строк текста и плашек: отступ 12, ячейки по центру (каталог А1, 15997:52);
 * relaxed — справочники из двух строк текста: отступ 16, зазор колонок 16, ячейки по верху,
 * под последней строкой линии нет (А8, 15966:8051);
 * roomy — реестр с контролами в строках: отступ 16 и у шапки, зазор 16, ячейки по центру,
 * нет линии ни под шапкой, ни под последней строкой (А6, 15966:7275).
 */
export type TableDensity = 'compact' | 'regular' | 'relaxed' | 'roomy'

const DensityContext = createContext<TableDensity>('compact')

/** Таблица данных (components.md: Table row / cell). */
interface TableProps {
  readonly caption: string
  readonly children: ReactNode
  /** fixed — ширины колонок задают ячейки шапки, а не содержимое (таблица исполнителей 09а). */
  readonly layout?: 'auto' | 'fixed'
  readonly density?: TableDensity
}

export function Table({ caption, children, layout = 'auto', density = 'compact' }: TableProps) {
  return (
    <DensityContext value={density}>
      <table className={clsx('w-full border-collapse text-left', layout === 'fixed' && 'table-fixed')}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </DensityContext>
  )
}

export function TableHead({ children }: { readonly children: ReactNode }) {
  const density = use(DensityContext)
  return <thead className={clsx(density === 'roomy' && '[&>tr]:border-b-0')}>{children}</thead>
}

export function TableBody({ children }: { readonly children: ReactNode }) {
  const density = use(DensityContext)
  return <tbody className={clsx((density === 'relaxed' || density === 'roomy') && '[&>tr:last-child]:border-b-0')}>{children}</tbody>
}

interface TableRowProps {
  readonly children: ReactNode
  readonly selected?: boolean
  /**
   * Щелчок по всей строке — удобство для мыши (список проектов A1). С клавиатуры строку открывает
   * ссылка внутри неё, поэтому щелчки по ссылкам и кнопкам строки сюда не передаются.
   */
  readonly onClick?: () => void
}

export function TableRow({ children, selected = false, onClick }: TableRowProps) {
  const handleClick = onClick && ((event: MouseEvent<HTMLTableRowElement>) => {
    if (event.target instanceof Element && event.target.closest('a, button')) return
    onClick()
  })
  return (
    <tr
      aria-selected={selected || undefined}
      onClick={handleClick}
      className={clsx('border-b border-border transition-colors hover:bg-surface-muted', selected && 'bg-surface-sunken', onClick && 'cursor-pointer')}
    >
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

// relaxed: подпись колонки в блоке 20 px (15966:8043) — снизу 8 + 4.
const HEADER_PADDING: Record<TableDensity, string> = { compact: 'py-8 pr-12 align-top', regular: 'py-8 pr-12 align-top', relaxed: 'pt-8 pb-12 pr-16 align-top', roomy: 'py-16 pr-16 align-middle' }
const CELL_PADDING: Record<TableDensity, string> = { compact: 'py-8 pr-12 align-middle', regular: 'py-12 pr-12 align-middle', relaxed: 'py-16 pr-16 align-top', roomy: 'py-16 pr-16 align-middle' }

interface TableHeaderCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  readonly align?: Align
  readonly tone?: HeaderTone
}

export function TableHeaderCell({ align = 'start', tone = 'overline', className, ...rest }: TableHeaderCellProps) {
  const density = use(DensityContext)
  return <th scope="col" className={clsx('last:pr-0', HEADER_PADDING[density], HEADER_TONE[tone], ALIGN[align], className)} {...rest} />
}

export function TableCell({ align = 'start', className, ...rest }: Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> & { readonly align?: Align }) {
  const density = use(DensityContext)
  return <td className={clsx('type-body text-text last:pr-0', CELL_PADDING[density], ALIGN[align], className)} {...rest} />
}
