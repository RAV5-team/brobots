import { RangeBar } from '@/components/charts/RangeBar'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'
import { sensitivityView } from '../../steps/economics/economicsTables'
import { acquisitionName } from '../../steps/economics/economicsView'
import { scenarioName, type ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.project.economics.sensitivity

/**
 * 10. Чувствительность (PRD 11.6; ТЗ 3.5.6): три параметра ±20 % по каждому сценарию — `RangeBar` и таблица
 * «Устойчивости» итога 08 (`sensitivityView`), сверху самый влиятельный.
 */
export function SensitivitySection({ ctx }: { readonly ctx: ReportContext }) {
  const c = t.columns
  return (
    <ReportSection n={10} sectionKey="sensitivity" lead={ru.report.sensitivity.lead}>
      {ctx.scenarios.map((scenario) => {
        const rows = sensitivityView(scenario, ctx.scenarios.filter((s) => s !== scenario), ctx.economics, ctx.facts)
        const name = scenarioName(ctx, scenario.acquisition)
        return (
          <div key={scenario.acquisition} className="flex flex-col gap-12">
            <ReportSubheading>{name}</ReportSubheading>
            <div className="break-inside-avoid"><RangeBar label={`${t.title} · ${name}`} valueLabel={t.valueLabel} rows={rows.map((row) => row.range)} /></div>
            <Table caption={t.tableCaption(acquisitionName(scenario.acquisition))}>
              <ReportHeadRow>
                <TableHeaderCell tone="label">{c.parameter}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.base}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.payback}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.tco}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.conclusion}</TableHeaderCell>
              </ReportHeadRow>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="pl-10 font-medium">{row.label}</TableCell>
                    <TableCell className="type-body-sm">{row.base}</TableCell>
                    <TableCell className="type-body-sm">{row.payback}</TableCell>
                    <TableCell className="type-body-sm">{row.tco}</TableCell>
                    <TableCell className="type-body-sm text-text-secondary">{row.conclusion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      })}
      <p className="type-caption text-text-secondary">{t.note}</p>
    </ReportSection>
  )
}
