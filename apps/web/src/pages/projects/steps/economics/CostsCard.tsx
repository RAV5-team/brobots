import { clsx } from 'clsx'
import { Card } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { CostItem, ScenarioEconomics } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { ChainRow } from './economicsTables'
import { acquisitionName, money } from './economicsView'

const t = ru.project.economics.costs

interface CostsCardProps {
  readonly scenario: ScenarioEconomics
  readonly solutionName: string
  readonly chain: readonly ChainRow[]
  readonly laborSavingsRub: number
}

function ItemRows({ title, items }: { readonly title: string; readonly items: readonly CostItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amountRub, 0)
  return (
    <>
      <TableRow>
        <TableHeaderCell scope="rowgroup" colSpan={2}>{title}</TableHeaderCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item.code}>
          <TableCell>{item.label}</TableCell>
          <TableCell align="end">{money(item.amountRub)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="font-semibold">{t.total}</TableCell>
        <TableCell align="end" className="font-semibold">{money(total)}</TableCell>
      </TableRow>
    </>
  )
}

/**
 * «Из чего складываются затраты и эффект» и «Состав CAPEX и OPEX» (PRD 11.5; в макете 08 нет — собрано из `Table`
 * по D-86): цепочка от текущих расходов к эффекту, как реализуется экономия ФОТ и статьи расчёта подбора.
 */
export function CostsCard({ scenario, solutionName, chain, laborSavingsRub }: CostsCardProps) {
  const name = `${solutionName} · ${acquisitionName(scenario.acquisition)}`
  const hasItems = scenario.capexItems.length > 0 || scenario.opexItems.length > 0
  return (
    <Card as="section" padding={24} gap={16} aria-labelledby="economics-costs-title">
      <h2 id="economics-costs-title" className="type-heading text-text">{t.title}</h2>
      <Table caption={t.caption(name)} density="regular">
        <TableHead>
          <TableRow>
            <TableHeaderCell>{t.columns.line}</TableHeaderCell>
            <TableHeaderCell>{t.columns.note}</TableHeaderCell>
            <TableHeaderCell align="end">{t.columns.amount}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {chain.map((row) => (
            <TableRow key={row.key}>
              <TableCell className={clsx(row.total && 'font-semibold')}>{row.label}</TableCell>
              <TableCell className="text-text-secondary">{row.note}</TableCell>
              <TableCell align="end" className={clsx('whitespace-nowrap', row.total && 'font-semibold')}>{row.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Card as="section" variant="sunken" padding={16} gap={4} aria-labelledby="economics-labor-title">
        <h3 id="economics-labor-title" className="type-body font-semibold text-text">{t.laborTitle}</h3>
        <p className="type-body-sm text-text-secondary">{t.laborText(money(laborSavingsRub))}</p>
      </Card>
      <h3 className="type-body font-semibold text-text">{t.itemsTitle(name)}</h3>
      {hasItems
        ? (
          <Table caption={t.itemsTitle(name)}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t.itemsColumns.item}</TableHeaderCell>
                <TableHeaderCell align="end">{t.itemsColumns.amount}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <ItemRows title={t.capexGroup} items={scenario.capexItems} />
              <ItemRows title={t.opexGroup} items={scenario.opexItems} />
            </TableBody>
          </Table>
        )
        : <p className="type-body-sm text-text-secondary">{t.noItems}</p>}
    </Card>
  )
}
