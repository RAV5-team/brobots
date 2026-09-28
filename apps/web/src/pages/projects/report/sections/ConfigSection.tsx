import { Chip, type ChipTone } from '@/components/ui/Chip'
import { FormulaStats } from '@/components/ui/FormulaStats'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { CheckStatus } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { fleetText } from '../../steps/economics/economicsView'
import { demandOf, howCalcSections } from '../../steps/matching/howCalculatedModel'
import { applicabilityRows, isCountSection, scenarioName, type ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.config

/** Плашка результата проверки: соответствует — лаймовая, как «подтверждено» (D-76); не соответствует — тёмная. */
const TONES: Record<CheckStatus, ChipTone> = { pass: 'accent', fail: 'inverse', unknown: 'neutral', not_applicable: 'muted' }

/**
 * 5. Обоснование выбранной конфигурации (PRD 11.6): матрица применимости выбранного решения (`applicabilityRows`) и расчёт количества
 * роботов и станций на числах подбора; если симуляция поменяла состав — строкой под расчётом.
 */
export function ConfigSection({ ctx }: { readonly ctx: ReportContext }) {
  const { variant, run } = ctx
  const name = scenarioName(ctx, ctx.selected)
  const c = t.columns
  const { processName, demand } = demandOf(ctx.snapshot, ctx.matching, ctx.project)
  const sections = variant
    ? howCalcSections({ variant, processName, demand, params: ctx.matching.calcDefaults, baseline: ctx.matching.baseline })
      .filter((s) => isCountSection(s.key))
    : []
  const checks = applicabilityRows(ctx)
  const plan = ctx.project.inputs.simulation?.plan ?? run?.to ?? null
  return (
    <ReportSection n={5} sectionKey="config">
      <ReportSubheading>{t.applicability}</ReportSubheading>
      {checks.length > 0
        ? (
            <Table caption={t.applicabilityCaption(name)}>
              <ReportHeadRow>
                <TableHeaderCell tone="label">{c.check}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.requirement}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.result}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.note}</TableHeaderCell>
              </ReportHeadRow>
              <TableBody>
                {checks.map((check) => (
                  <TableRow key={check.key}>
                    <TableCell className="pl-10">{check.label}</TableCell>
                    <TableCell className="font-medium">{check.requirement}</TableCell>
                    <TableCell><Chip size="xs" tone={TONES[check.status]}>{t.checkStatuses[check.status]}</Chip></TableCell>
                    <TableCell className="type-body-sm text-text-secondary">{check.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        : <p className="type-body-sm text-text-secondary">{t.noChecks}</p>}
      <ReportSubheading>{t.count}</ReportSubheading>
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-4 break-inside-avoid">
          <p className="type-overline font-medium text-text-muted">{section.title}</p>
          <FormulaStats label={`${t.countLabel} · ${section.title}`} stats={section.stats} layout="list" />
        </div>
      ))}
      {run && plan && <p className="type-body-sm text-text-secondary">{t.plan(fleetText(run.from.robots, run.from.stations), fleetText(plan.robots, plan.stations))}</p>}
    </ReportSection>
  )
}
