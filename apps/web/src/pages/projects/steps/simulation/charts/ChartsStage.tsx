import type { ReactNode } from 'react'
import { BarChart } from '@/components/charts/BarChart'
import type { LegendItem } from '@/components/charts/ChartLegend'
import { BOARD_TIME_TONES, type ChartSeries, type ChartTone } from '@/components/charts/chartTones'
import { HourlyTable } from '@/components/charts/HourlyTable'
import { StackedBar } from '@/components/charts/StackedBar'
import { Card } from '@/components/ui/Card'
import type { Fleet, SimulationRun } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  TIME_SEGMENTS,
  boardFleets,
  boardHourly,
  fleetCaption,
  fromShiftStart,
  hasViolation,
  hourLabel,
  hourViolations,
  isPeakHour,
  timeSegments,
  tripShare,
  type ChartFleet,
  type ServiceTargets,
} from './chartsModel'
import { PlayersCard } from './PlayersCard'

const t = ru.project.simulation
const c = t.charts
/** Тона составов: из подбора — чёрный, с изменениями — лайм (17040:65). */
const FLEET_TONE: Readonly<Record<ChartFleet['key'], ChartTone>> = { before: 'strong', after: 'accent' }
const LOAD_HEIGHT = 96
const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1)
const AXIS_STEPS = 2

export interface ChartsStageProps {
  readonly run: SimulationRun
  readonly fromMatching: Fleet
  readonly targets: ServiceTargets
  /** Начало первой смены (этап 2): часы графика и таблицы — от него, 07 … 06. */
  readonly startHour: number
}

/** Карточка вкладки: заголовок 16 и подзаголовок 12 (17040:56). */
function ChartCard({ id, title, lead, children, padding = 28 }: { readonly id: string; readonly title: string; readonly lead: string; readonly children: ReactNode; readonly padding?: 24 | 28 }) {
  return (
    <Card padding={padding} gap={20} aria-labelledby={id}>
      <div className="flex flex-col gap-4">
        <h2 id={id} className="type-heading text-text">{title}</h2>
        <p className="type-caption text-text-secondary">{lead}</p>
      </div>
      {children}
    </Card>
  )
}

/**
 * «Загрузка по часам» (17040:55): тройки столбцов «потребность · из подбора · с изменениями», ось рейсов в час, пик —
 * чертой под часом, легенда слева с итогом каждого состава в пик («вывод первым»). Ниже на подложке — таблица по часам:
 * по умолчанию только показатели, где составы различаются (решение 12).
 */
function LoadCard({ run, fleets, targets, startHour }: { readonly run: SimulationRun; readonly fleets: readonly ChartFleet[]; readonly targets: ServiceTargets; readonly startHour: number }) {
  const required = run.peak.requiredPerHour
  const served = (f: ChartFleet) => (f.key === 'before' && fleets.length > 1 ? run.before.peak.servedPerHour : run.peak.servedPerHour)
  // «Потребность» — с заглавной, единица — второй строкой легенды (17061:2).
  const demand: ChartSeries = { key: 'demand', label: capitalize(t.load.demand), tone: 'muted' }
  const series: readonly ChartSeries[] = [demand, ...fleets.map((f) => ({ key: f.key, label: c.option(f.title, f.fleet.robots, f.fleet.stations), tone: FLEET_TONE[f.key] }))]
  const legend: readonly LegendItem[] = [
    { ...demand, detail: c.perHour },
    ...series.slice(1).map((s, i) => ({ ...s, detail: c.inPeak(formatNumber(fleets[i] ? served(fleets[i]) : 0), formatNumber(required)) })),
    { key: 'peak', label: c.peakHour, tone: 'strong', marker: 'dash' },
    { key: 'violation', label: c.violationFrame, detail: c.violationDetail, tone: 'danger', marker: 'frame' },
  ]
  const hours = fleets.map((f) => fromShiftStart(f.hours, startHour))
  const table = boardHourly(fleets, targets, startHour)
  return (
    // Отступ 24 и таблица без подложки — временно: HourlyTable не уже 1030 px (--rav-hourly-table-min-width), а на подложке
    // карточки 28 доступно 982 px — появлялась прокрутка без фокуса (axe scrollable-region-focusable). Ждёт правки в main.
    <ChartCard id="charts-load-title" title={t.load.title} lead={fleets.length > 1 ? c.loadLead : c.loadLeadSingle} padding={24}>
      <BarChart
        label={t.load.title}
        categoryLabel={t.hourly.hour}
        series={series}
        data={(hours[0] ?? []).map((h, i) => ({
          key: hourLabel(h.hour),
          label: hourLabel(h.hour),
          values: [h.demand, ...hours.map((fh) => fh[i]?.done ?? 0)],
          highlight: isPeakHour(h, run),
          violation: hours.some((fh) => { const x = fh[i]; return x !== undefined && hasViolation({ ...hourViolations(x, targets), utilization: false }) }),
        }))}
        formatValue={(v) => formatNumber(v)}
        height={LOAD_HEIGHT}
        axis={{ ticks: Array.from({ length: AXIS_STEPS + 1 }, (_, k) => (required * k) / AXIS_STEPS), unit: c.perHour }}
        peakMark
        legend
        legendPosition="left"
        legendItems={legend}
      />
      <div>
        <h3 id="charts-hourly-title" className="sr-only">{t.hourly.caption}</h3>
        <HourlyTable
          labelledBy="charts-hourly-title"
          categoryLabel={t.hourly.hour}
          columns={table.columns}
          rows={[table.demand]}
          groups={table.groups}
          violation="outline"
          violationLabel={t.hourly.violation}
          onlyDiffering={fleets.length > 1}
          toggle={{ showAll: c.showAll, onlyDiffering: c.onlyDiffering }}
        />
      </div>
    </ChartCard>
  )
}

/** «Куда уходит время роботов» (17040:626): полосы по составам, тона доски — ремонт лаймом, ожидание серым. */
function TimeCard({ fleets }: { readonly fleets: readonly ChartFleet[] }) {
  const rows = fleets.flatMap((f) => {
    const segments = timeSegments(f.shares)
    return segments ? [{ key: f.key, label: t.time.row(fleetCaption(f), formatPercent(tripShare(segments))), values: segments }] : []
  })
  return (
    <ChartCard id="charts-time-title" title={c.timeTitle} lead={c.timeLead}>
      {rows.length === 0
        ? <p className="type-body-sm text-text-secondary">{t.time.empty}</p>
        : <StackedBar label={c.timeTitle} segments={TIME_SEGMENTS} tones={BOARD_TIME_TONES} legendShape="dot" rows={rows} formatShare={(s) => formatPercent(s)} />}
    </ChartCard>
  )
}

/**
 * Вкладка «Графики и 2D-сравнение» (3.5 · облегчённый, 17040:10; PRD 11.4; D-105): оба состава сразу — без переключателя,
 * вывод первым — итог в пик в легенде графика. Вкладка только для просмотра: действия — на «Вердикт и действия» (3.4).
 */
export function ChartsStage({ run, fromMatching, targets, startHour }: ChartsStageProps) {
  const fleets = boardFleets(run, fromMatching)
  if (fleets.length === 0) return null
  return (
    <>
      <LoadCard run={run} fleets={fleets} targets={targets} startHour={startHour} />
      <TimeCard fleets={fleets} />
      <PlayersCard run={run} fleets={fleets} />
    </>
  )
}
