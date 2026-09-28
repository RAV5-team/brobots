import { Chip } from '@/components/ui/Chip'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { acquisitionName, money, years } from '../../steps/economics/economicsView'
import { conditionValue, formatScore, isSelected, reasonsText } from '../../steps/matching/matchingModel'
import type { ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.variants

function Ranking({ ctx }: { readonly ctx: ReportContext }) {
  const c = t.columns
  const selection = ctx.project.inputs.matching?.selection ?? null
  return (
    <Table caption={t.rankingCaption}>
      <ReportHeadRow>
        <TableHeaderCell tone="label">{c.rank}</TableHeaderCell>
        <TableHeaderCell tone="label">{c.solution}</TableHeaderCell>
        <TableHeaderCell tone="label" align="end">{c.robots}</TableHeaderCell>
        <TableHeaderCell tone="label" align="end">{c.capex}</TableHeaderCell>
        <TableHeaderCell tone="label" align="end">{c.effect}</TableHeaderCell>
        <TableHeaderCell tone="label" align="end">{c.payback}</TableHeaderCell>
        <TableHeaderCell tone="label" align="end">{c.score}</TableHeaderCell>
        <TableHeaderCell tone="label">{c.status}</TableHeaderCell>
      </ReportHeadRow>
      <TableBody>
        {ctx.matching.variants.map((v) => (
          <TableRow key={`${v.solutionId}:${v.acquisition}`} selected={isSelected(v, selection)}>
            <TableCell className="pl-10">{v.rank === null ? '—' : String(v.rank)}</TableCell>
            <TableCell className="font-medium">
              <span className="flex flex-wrap items-center gap-8">
                {`${v.solutionName} · ${acquisitionName(v.acquisition)}`}
                {isSelected(v, selection) && <Chip size="xs" tone="inverse">{t.selected}</Chip>}
              </span>
            </TableCell>
            <TableCell align="end">{formatNumber(v.robots)}</TableCell>
            <TableCell align="end" className="whitespace-nowrap">{money(v.capexRub)}</TableCell>
            <TableCell align="end" className="whitespace-nowrap">{money(v.annualEffectRub)}</TableCell>
            <TableCell align="end" className="whitespace-nowrap">{years(v.paybackYears)}</TableCell>
            <TableCell align="end">{v.score === null ? '—' : formatScore(v.score)}</TableCell>
            <TableCell className="text-text-secondary">{v.rank === null ? t.outOfRank : t.statuses[v.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Weights({ ctx }: { readonly ctx: ReportContext }) {
  const criteria = ctx.variant?.criteria ?? ctx.matching.variants.find((v) => v.criteria.length > 0)?.criteria ?? []
  if (criteria.length === 0) return null
  const c = t.weightColumns
  return (
    <>
      <ReportSubheading>{t.weights}</ReportSubheading>
      <Table caption={t.weightsCaption}>
        <ReportHeadRow>
          <TableHeaderCell tone="label">{c.criterion}</TableHeaderCell>
          <TableHeaderCell tone="label" align="end">{c.weight}</TableHeaderCell>
          <TableHeaderCell tone="label" align="end">{c.contribution}</TableHeaderCell>
        </ReportHeadRow>
        <TableBody>
          {criteria.map((criterion) => (
            <TableRow key={criterion.code}>
              <TableCell className="pl-10">{criterion.label}</TableCell>
              <TableCell align="end">{formatPercent(criterion.weight)}</TableCell>
              <TableCell align="end">{criterion.contribution === null ? '—' : formatScore(criterion.contribution)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function Conditions({ ctx }: { readonly ctx: ReportContext }) {
  const c = t.conditionColumns
  return (
    <>
      <ReportSubheading>{t.conditions}</ReportSubheading>
      <Table caption={t.conditionsCaption}>
        <ReportHeadRow>
          <TableHeaderCell tone="label">{c.condition}</TableHeaderCell>
          <TableHeaderCell tone="label">{c.value}</TableHeaderCell>
          <TableHeaderCell tone="label">{c.applicable}</TableHeaderCell>
        </ReportHeadRow>
        <TableBody>
          {ctx.matching.conditions.map((condition) => (
            <TableRow key={condition.code}>
              <TableCell className="pl-10">{condition.label}</TableCell>
              <TableCell className="font-medium">{conditionValue(condition) || '—'}</TableCell>
              <TableCell className="text-text-secondary">{condition.applicable ? t.yes : t.no}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function Excluded({ ctx }: { readonly ctx: ReportContext }) {
  const c = t.excludedColumns
  return (
    <>
      <ReportSubheading>{t.excluded}</ReportSubheading>
      {ctx.matching.excluded.length === 0
        ? <p className="type-body-sm text-text-secondary">{t.noExcluded}</p>
        : (
            <Table caption={t.excludedCaption}>
              <ReportHeadRow>
                <TableHeaderCell tone="label">{c.solution}</TableHeaderCell>
                <TableHeaderCell tone="label">{c.reasons}</TableHeaderCell>
              </ReportHeadRow>
              <TableBody>
                {ctx.matching.excluded.map((solution) => (
                  <TableRow key={solution.solutionId}>
                    <TableCell className="w-(--rav-report-label-width) pl-10 font-medium">{`${solution.solutionName} · ${solution.manufacturer}`}</TableCell>
                    <TableCell className="type-body-sm text-text-secondary">{reasonsText(solution)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
    </>
  )
}

/**
 * 4. Рассмотренные варианты и метод выбора (16197:2404–2435; PRD 11.6): рейтинг подбора, критерии и веса,
 * условия отбора и исключённые решения с причинами.
 */
export function VariantsSection({ ctx }: { readonly ctx: ReportContext }) {
  const { counts } = ctx.matching
  return (
    <ReportSection n={4} sectionKey="variants" lead={t.lead(formatCount(counts.total, ru.project.matching.plural.solutions), counts.passed + counts.needsVerification, counts.excluded)}>
      <ReportSubheading>{t.ranking}</ReportSubheading>
      <Ranking ctx={ctx} />
      <Weights ctx={ctx} />
      <Conditions ctx={ctx} />
      <Excluded ctx={ctx} />
    </ReportSection>
  )
}
