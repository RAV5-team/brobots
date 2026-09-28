import { clsx } from 'clsx'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { newCostItems } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { chainRows, scenarioRows, type ColumnKey } from '../../steps/economics/economicsTables'
import { acquisitionName, money } from '../../steps/economics/economicsView'
import { scenarioName, type ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.economics
const e = ru.project.economics

/**
 * 7. Экономическое сравнение (16197:2436–2469; PRD 11.6): текущий процесс, покупка и RaaS по 14 строкам
 * «Сравнения сценариев» 08 (`scenarioRows`) и цепочка эффекта выбранного сценария (`chainRows`) — числа 08.
 */
export function EconomicsSection({ ctx }: { readonly ctx: ReportContext }) {
  const { economics, scenarios, facts, run, scenario } = ctx
  const rows = scenarioRows({ economics, scenarios, facts, run, conditions: economics.conditions })
  const columns: readonly { readonly key: ColumnKey; readonly label: string }[] = [
    { key: 'current', label: e.scenarios.current },
    ...scenarios.map((s) => ({
      key: s.acquisition,
      label: s.acquisition === ctx.selected ? `${acquisitionName(s.acquisition)} · ${e.scenarios.selected}` : acquisitionName(s.acquisition),
    })),
  ]
  const chain = chainRows(scenario, economics, facts, newCostItems(scenario))
  const name = scenarioName(ctx, scenario.acquisition)
  return (
    <ReportSection n={7} sectionKey="economics" lead={t.lead(facts?.volume ?? '—', String(facts?.hoursPerDay ?? '—'), ctx.horizon)}>
      <Table caption={t.caption}>
        <ReportHeadRow>
          <TableHeaderCell tone="label">{ru.report.columns.item}</TableHeaderCell>
          {columns.map((c) => <TableHeaderCell key={c.key} tone="label">{c.label}</TableHeaderCell>)}
        </ReportHeadRow>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="pl-10 text-text-secondary">{row.label}</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} className={clsx('type-body-sm', c.key === ctx.selected && 'font-semibold')}>
                  {row.values[c.key]}
                  {row.mark?.column === c.key && <span className="block type-caption font-medium text-on-accent">{row.mark.text}</span>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReportSubheading>{t.chain(name)}</ReportSubheading>
      <Table caption={e.costs.caption(name)}>
        <ReportHeadRow>
          <TableHeaderCell tone="label">{e.costs.columns.line}</TableHeaderCell>
          <TableHeaderCell tone="label">{e.costs.columns.note}</TableHeaderCell>
          <TableHeaderCell tone="label" align="end">{e.costs.columns.amount}</TableHeaderCell>
        </ReportHeadRow>
        <TableBody>
          {chain.map((row) => (
            <TableRow key={row.key}>
              <TableCell className={clsx('pl-10', row.total && 'font-semibold')}>{row.label}</TableCell>
              <TableCell className="type-body-sm text-text-secondary">{row.note}</TableCell>
              <TableCell align="end" className={clsx('whitespace-nowrap', row.total && 'font-semibold')}>{row.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="type-body-sm text-text-secondary">
        <span className="font-semibold text-text">{`${e.costs.laborTitle}. `}</span>
        {e.costs.laborText(money(scenario.laborSavingsRubPerYear ?? 0))}
      </p>
    </ReportSection>
  )
}
