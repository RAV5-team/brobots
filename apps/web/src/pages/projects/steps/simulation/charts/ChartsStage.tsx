import { useState, type ReactNode } from 'react'
import { BarChart } from '@/components/charts/BarChart'
import { ChartLegend } from '@/components/charts/ChartLegend'
import type { ChartSeries } from '@/components/charts/chartTones'
import { HourlyTable } from '@/components/charts/HourlyTable'
import { StackedBar } from '@/components/charts/StackedBar'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { VerdictActions, type VerdictActionsProps } from '../VerdictActions'
import {
  BUSY_LIMIT,
  TIME_SEGMENTS,
  chartFleets,
  fleetCaption,
  hasViolation,
  hourLabel,
  hourViolations,
  hourlyRows,
  isPeakHour,
  timeSegments,
  tripShare,
  type ChartFleet,
  type ServiceTargets,
} from './chartsModel'
import { PlayersCard } from './PlayersCard'

const t = ru.project.simulation
const LOAD_SERIES: readonly ChartSeries[] = [{ key: 'demand', label: t.load.demand, tone: 'muted' }, { key: 'done', label: t.load.done, tone: 'strong' }]

interface ChartsStageProps extends VerdictActionsProps {
  readonly targets: ServiceTargets
}

/** Карточка вкладки: заголовок 16 и, при необходимости, действие справа (16198:85). */
function ChartCard({ id, title, action, children }: { readonly id: string; readonly title: string; readonly action?: ReactNode; readonly children: ReactNode }) {
  return (
    <Card padding={24} aria-labelledby={id}>
      <div className="flex min-h-44 flex-wrap items-center justify-between gap-12">
        <h2 id={id} className="type-heading text-text">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

function LoadCard({ run, fleet, targets, switcher }: { readonly run: VerdictActionsProps['run']; readonly fleet: ChartFleet; readonly targets: ServiceTargets; readonly switcher: ReactNode }) {
  return (
    <ChartCard id="charts-load-title" title={t.load.title} action={switcher}>
      <BarChart
        label={`${t.load.title} · ${fleetCaption(fleet)}`}
        categoryLabel={t.hourly.hour}
        series={LOAD_SERIES}
        data={fleet.hours.map((h) => ({
          key: hourLabel(h.hour),
          label: hourLabel(h.hour),
          values: [h.demand, h.done],
          highlight: isPeakHour(h, run),
          violation: hasViolation(hourViolations(h, targets)),
        }))}
        formatValue={(v) => formatNumber(v)}
        height={120}
      />
      <div className="flex flex-wrap items-center gap-x-16 gap-y-8">
        <ChartLegend series={LOAD_SERIES} />
        <p className="type-caption text-text-secondary">{t.load.note}</p>
      </div>
    </ChartCard>
  )
}

function HourlyCard({ fleet, targets }: { readonly fleet: ChartFleet; readonly targets: ServiceTargets }) {
  return (
    <ChartCard id="charts-hourly-title" title={t.hourly.caption}>
      <HourlyTable
        labelledBy="charts-hourly-title"
        categoryLabel={t.hourly.hour}
        columns={fleet.hours.map((h) => hourLabel(h.hour))}
        rows={hourlyRows(fleet.hours, targets)}
        violationLabel={t.hourly.violation}
      />
      <p className="type-caption text-text-secondary">{t.hourly.note(formatPercent(BUSY_LIMIT), formatPercent(targets.onTimeTarget))}</p>
    </ChartCard>
  )
}

function TimeCard({ fleets }: { readonly fleets: readonly ChartFleet[] }) {
  const rows = fleets.flatMap((f) => {
    const segments = timeSegments(f.shares)
    return segments ? [{ key: f.key, label: t.time.row(fleetCaption(f), formatPercent(tripShare(segments))), values: segments }] : []
  })
  return (
    <ChartCard id="charts-time-title" title={t.time.title}>
      {rows.length === 0
        ? <p className="type-body-sm text-text-secondary">{t.time.empty}</p>
        : <StackedBar label={t.time.title} segments={TIME_SEGMENTS} rows={rows} formatShare={(s) => formatPercent(s)} />}
    </ChartCard>
  )
}

/**
 * Вкладка «Графики и 2D-сравнение» (07a, 16198:61; PRD 11.4; D-105): загрузка по часам и таблица часа по выбранному
 * составу, время роботов по обоим составам, два 2D-плеера с общим временем и те же действия, что у вкладки вердикта.
 */
export function ChartsStage({ targets, ...actions }: ChartsStageProps) {
  const fleets = chartFleets(actions.run, actions.fromMatching)
  const [selected, setSelected] = useState<ChartFleet['key']>('after')
  const fleet = fleets.find((f) => f.key === selected) ?? fleets[0]
  if (!fleet) return null
  const switcher = fleets.length > 1 && (
    <Segmented
      label={t.charts.fleetLabel}
      fit="content"
      value={fleet.key}
      onChange={setSelected}
      options={fleets.map((f) => ({ value: f.key, label: t.charts.option(f.title, f.fleet.robots, f.fleet.stations) }))}
    />
  )
  return (
    <>
      <LoadCard run={actions.run} fleet={fleet} targets={targets} switcher={switcher} />
      <HourlyCard fleet={fleet} targets={targets} />
      <TimeCard fleets={fleets} />
      <PlayersCard run={actions.run} fleets={fleets} />
      <VerdictActions {...actions} />
    </>
  )
}
