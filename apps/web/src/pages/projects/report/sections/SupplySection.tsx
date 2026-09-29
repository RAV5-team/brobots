import { Table, TableBody, TableHeaderCell } from '@/components/ui/Table'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { acquisitionName } from '../../steps/economics/economicsView'
import { scenarioName, type FactRow, type ReportContext } from '../reportModel'
import { FactTable, ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'
import { CostItemRows } from '../../shared/CostItemRows'

const t = ru.report.supply
const costs = ru.project.economics.costs

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
                <CostItemRows variant="report" title={costs.capexGroup} items={s.capexItems} />
                <CostItemRows variant="report" title={costs.opexGroup} items={s.opexItems} />
              </TableBody>
            </Table>
          )
        : <p className="type-body-sm text-text-secondary">{costs.noItems}</p>}
    </ReportSection>
  )
}
