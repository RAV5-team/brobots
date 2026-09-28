import { Chip, type ChipTone } from '@/components/ui/Chip'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { ConditionStatus } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { acquisitionName } from '../../steps/economics/economicsView'
import type { ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.assumptions
const c = ru.project.economics.conditions

/** Тоны статуса — как в «Условиях решения» итога 08 (D-106). */
const TONES: Record<ConditionStatus, ChipTone> = { confirmed: 'accent', needs_check: 'neutral', assumption: 'muted', no_data: 'inverse' }

/**
 * 11. Допущения и следующие проверки (16197:2470–2475; PRD 11.6): реестр условий решения по обоим сценариям,
 * а не список рисков макета, и замечания подбора выбранного варианта.
 */
export function AssumptionsSection({ ctx }: { readonly ctx: ReportContext }) {
  const col = c.columns
  const warnings = ctx.variant?.warnings ?? []
  return (
    <ReportSection n={11} sectionKey="assumptions" lead={t.lead}>
      {ctx.economics.conditions.length === 0
        ? <p className="type-body-sm text-text-secondary">{c.empty}</p>
        : (
            <Table caption={c.title}>
              <ReportHeadRow>
                <TableHeaderCell tone="label">{col.parameter}</TableHeaderCell>
                <TableHeaderCell tone="label">{col.status}</TableHeaderCell>
                <TableHeaderCell tone="label">{col.impact}</TableHeaderCell>
                <TableHeaderCell tone="label">{col.confirm}</TableHeaderCell>
              </ReportHeadRow>
              <TableBody>
                {ctx.economics.conditions.map((row) => (
                  <TableRow key={`${row.parameter}:${row.acquisition ?? 'all'}`}>
                    <TableCell className="pl-10">
                      <span className="flex flex-col gap-2">
                        <span className="font-medium">{row.parameter}</span>
                        {row.value !== '—' && <span className="type-caption text-text-secondary">{`${col.value}: ${row.value}`}</span>}
                        <span className="type-caption text-text-secondary">
                          {`${t.scenario}: ${row.acquisition ? acquisitionName(row.acquisition) : t.both}`}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col items-start gap-4">
                        <Chip size="xs" tone={TONES[row.status]}>{c.statuses[row.status]}</Chip>
                        {row.blocksConclusion && row.status !== 'confirmed' && <span className="type-caption font-medium text-text">{t.blocks}</span>}
                        <span className="type-caption text-text-secondary">{row.source}</span>
                      </span>
                    </TableCell>
                    <TableCell className="type-body-sm">{row.impact}</TableCell>
                    <TableCell className="type-body-sm text-text-secondary">{row.howToConfirm}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      {warnings.length > 0 && (
        <>
          <ReportSubheading>{t.warnings}</ReportSubheading>
          <ul className="flex list-disc flex-col gap-4 pl-20">
            {warnings.map((w) => <li key={w} className="type-body text-text-secondary">{w}</li>)}
          </ul>
        </>
      )}
    </ReportSection>
  )
}
