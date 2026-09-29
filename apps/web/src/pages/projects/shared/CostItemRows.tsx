import { TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { CostItem } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { money } from '../steps/economics/economicsView'

const t = ru.project.economics.costs

interface CostItemRowsProps {
  readonly title: string
  readonly items: readonly CostItem[]
  /** card — «Состав CAPEX и OPEX» итога 08; report — раздел 6 отчёта 09: строки с отступом, суммы в одну строку. */
  readonly variant?: 'card' | 'report'
}

/** Группа статей CAPEX или OPEX: заголовок группы, статьи и итог — строки таблицы. */
export function CostItemRows({ title, items, variant = 'card' }: CostItemRowsProps) {
  const total = items.reduce((sum, item) => sum + item.amountRub, 0)
  const report = variant === 'report'
  return (
    <>
      <TableRow>
        <TableHeaderCell scope="rowgroup" colSpan={2} {...(report ? { tone: 'label' as const, className: 'pl-10' } : {})}>{title}</TableHeaderCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item.code}>
          <TableCell className={report ? 'pl-10' : undefined}>{item.label}</TableCell>
          <TableCell align="end" className={report ? 'whitespace-nowrap' : undefined}>{money(item.amountRub)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className={report ? 'pl-10 font-semibold' : 'font-semibold'}>{t.total}</TableCell>
        <TableCell align="end" className={report ? 'font-semibold whitespace-nowrap' : 'font-semibold'}>{money(total)}</TableCell>
      </TableRow>
    </>
  )
}
