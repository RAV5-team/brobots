import { BarChart } from '@/components/charts/BarChart'
import type { ChartSeries } from '@/components/charts/chartTones'
import { StackedBar } from '@/components/charts/StackedBar'
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { RunKpis } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { fleetText } from '../../steps/economics/economicsView'
import {
  TIME_SEGMENTS,
  chartFleets,
  fleetCaption,
  hasViolation,
  hourLabel,
  hourViolations,
  isPeakHour,
  timeSegments,
  tripShare,
} from '../../steps/simulation/charts/chartsModel'
import { CONDITION_DEFAULTS } from '../../steps/simulation/conditionsModel'
import { matchingFleet } from '../../steps/simulation/simulationModel'
import type { ReportContext } from '../reportModel'
import { ReportHeadRow, ReportSection, ReportSubheading } from '../ReportSection'
import { SimulationFrame } from './SimulationFrame'

const t = ru.report.simulation
const s = ru.project.simulation
const LOAD_SERIES: readonly ChartSeries[] = [{ key: 'demand', label: s.load.demand, tone: 'muted' }, { key: 'done', label: s.load.done, tone: 'strong' }]

function kpiValues(kpis: RunKpis): readonly string[] {
  return [
    t.served(formatNumber(kpis.peak.servedPerHour), formatNumber(kpis.peak.requiredPerHour)),
    formatPercent(kpis.onTimeWorstDay, 1),
    formatPercent(kpis.utilizationPeak),
  ]
}

/**
 * 9. Результаты симуляции (PRD 11.6): вердикт прогона, «было → стало» по итогам проверенного и итогового составов,
 * загрузка по часам и время роботов — те же SVG, что на 07a (D-87), кадр 2D-схемы в первом пиковом часе.
 */
export function SimulationSection({ ctx }: { readonly ctx: ReportContext }) {
  const { run, variant } = ctx
  if (!run || !variant) {
    return <ReportSection n={9} sectionKey="simulation"><p className="type-body text-text-secondary">{t.none}</p></ReportSection>
  }
  const fleets = chartFleets(run, matchingFleet(variant))
  const after = fleets.find((f) => f.key === 'after') ?? fleets[0]
  const conditions = ctx.project.inputs.simulation?.conditions
  const targets = {
    onTimeTarget: conditions?.onTimeTarget ?? CONDITION_DEFAULTS.onTimeTarget,
    maxWaitMin: conditions?.maxWaitMin ?? CONDITION_DEFAULTS.maxWaitMin,
  }
  const afterKpis: RunKpis = { peak: run.peak, onTimeWorstDay: run.onTimeWorstDay, utilizationPeak: run.utilizationPeak, fleetShares: run.fleetShares }
  const before = kpiValues(run.before)
  const afterValues = kpiValues(afterKpis)
  const rows = [
    { key: 'fleet', label: t.rows.fleet, before: fleetText(run.from.robots, run.from.stations), after: fleetText(run.to.robots, run.to.stations) },
    { key: 'peak', label: t.rows.peak, before: before[0], after: afterValues[0] },
    { key: 'onTime', label: t.rows.onTime, before: before[1], after: afterValues[1] },
    { key: 'utilization', label: t.rows.utilization, before: before[2], after: afterValues[2] },
  ]
  const timeRows = fleets.flatMap((f) => {
    const segments = timeSegments(f.shares)
    return segments ? [{ key: f.key, label: s.time.row(fleetCaption(f), formatPercent(tripShare(segments))), values: segments }] : []
  })
  return (
    <ReportSection n={9} sectionKey="simulation" lead={t.run(run.id, run.title)}>
      {run.lines.length > 0 && (
        <ul className="flex flex-col gap-4">
          {run.lines.map((line) => <li key={line} className="type-body text-text-secondary">{line}</li>)}
        </ul>
      )}
      <ReportSubheading>{t.compare}</ReportSubheading>
      <Table caption={t.compareCaption}>
        <ReportHeadRow>
          <TableHeaderCell tone="label">{t.columns.metric}</TableHeaderCell>
          <TableHeaderCell tone="label">{t.columns.before}</TableHeaderCell>
          <TableHeaderCell tone="label">{t.columns.after}</TableHeaderCell>
        </ReportHeadRow>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="pl-10 text-text-secondary">{row.label}</TableCell>
              <TableCell>{row.before}</TableCell>
              <TableCell className="font-medium">{row.after}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {after && (
        <div className="flex flex-col gap-12 break-inside-avoid">
          <ReportSubheading>{t.load}</ReportSubheading>
          <BarChart
            label={`${s.load.title} · ${fleetCaption(after)}`}
            categoryLabel={s.hourly.hour}
            series={LOAD_SERIES}
            data={after.hours.map((h) => ({
              key: hourLabel(h.hour),
              label: hourLabel(h.hour),
              values: [h.demand, h.done],
              highlight: isPeakHour(h, run),
              violation: hasViolation(hourViolations(h, targets)),
            }))}
            formatValue={(v) => formatNumber(v)}
            height={120}
            legend
          />
          <p className="type-caption text-text-secondary">{s.load.note}</p>
        </div>
      )}
      {timeRows.length > 0 && (
        <div className="flex flex-col gap-12 break-inside-avoid">
          <ReportSubheading>{t.time}</ReportSubheading>
          <StackedBar label={s.time.title} segments={TIME_SEGMENTS} rows={timeRows} formatShare={(v) => formatPercent(v)} />
        </div>
      )}
      <ReportSubheading>{t.frame}</ReportSubheading>
      <SimulationFrame run={run} fleets={fleets} />
      {run.risks.length > 0 && (
        <>
          <ReportSubheading>{t.risks}</ReportSubheading>
          <ul className="flex list-disc flex-col gap-4 pl-20">
            {run.risks.map((risk) => <li key={risk} className="type-body text-text-secondary">{risk}</li>)}
          </ul>
        </>
      )}
    </ReportSection>
  )
}
