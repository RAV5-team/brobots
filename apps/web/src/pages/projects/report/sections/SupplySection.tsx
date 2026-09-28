import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { CostItem } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { acquisitionName, money } from '../../steps/economics/economicsView'
import { scenarioName, type FactRow, type ReportContext } from '../reportModel'
import { FactTable, ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.supply
const costs = ru.project.economics.costs

function ItemRows({ title, items }: { readonly title: string; readonly items: readonly CostItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amountRub, 0)
  return (
    <>
      <TableRow>
        <TableHeaderCell scope="rowgroup" colSpan={2} tone="label" className="pl-10">{title}</TableHeaderCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item.code}>
          <TableCell className="pl-10">{item.label}</TableCell>
          <TableCell align="end" className="whitespace-nowrap">{money(item.amountRub)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="pl-10 font-semibold">{costs.total}</TableCell>
        <TableCell align="end" className="font-semibold whitespace-nowrap">{money(total)}</TableCell>
      </TableRow>
    </>
  )
}

/**
 * 6. Состав поставки и внедрения (16197:2479; PRD 11.6): роботы, станции и модель приобретения, затем статьи
 * CAPEX и OPEX выбранного сценария — те же, что в «Составе CAPEX и OPEX» итога 08.
 */
export function SupplySection({ ctx }: { readonly ctx: ReportContext }) {
  const { scenario: s, economics } = ctx
  const rows: readonly FactRow[] = [
    { key: 'robots', label: t.robots, value: t.robotsValue(formatCount(s.robots, ru.plural.robots), economics.solutionName, economics.manufacturer) },
    { key: 'stations', label: t.stations, value: s.stations === null ? t.noStations : formatCount(s.stations, ru.plural.stations) },
    { key: 'acquisition', label: t.acquisition, value: acquisitionName(s.acquisition) },
  ]
  const name = scenarioName(ctx, s.acquisition)
  const hasItems = s.capexItems.length > 0 || s.opexItems.length > 0
  return (
    <ReportSection n={6} sectionKey="supply">
      <ReportSubheading>{t.equipment}</ReportSubheading>
      <FactTable caption={t.equipmentCaption} rows={rows} />
      <ReportSubheading>{t.costs(name)}</ReportSubheading>
      {hasItems
        ? (
            <Table caption={t.costs(name)}>
              <ReportHeadRow>
                <TableHeaderCell tone="label">{costs.itemsColumns.item}</TableHeaderCell>
                <TableHeaderCell tone="label" align="end">{costs.itemsColumns.amount}</TableHeaderCell>
              </ReportHeadRow>
              <TableBody>
                <ItemRows title={costs.capexGroup} items={s.capexItems} />
                <ItemRows title={costs.opexGroup} items={s.opexItems} />
              </TableBody>
            </Table>
          )
        : <p className="type-body-sm text-text-secondary">{costs.noItems}</p>}
    </ReportSection>
  )
}
