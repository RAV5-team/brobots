import { useEffect, useState } from 'react'
import { toEconomics } from '@/api/mappers/economics'
import { toSimulationRun } from '@/api/mappers/simulation'
import { toSimulationTrace } from '@/api/mappers/trace'
import { BarChart } from '@/components/charts/BarChart'
import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend'
import { HourlyTable, type HourlyTableGroup, type HourlyTableRow } from '@/components/charts/HourlyTable'
import { PlaybackTimeline } from '@/components/charts/PlaybackTimeline'
import { RangeBar } from '@/components/charts/RangeBar'
import { boardRobotLegend } from '@/components/charts/robotGroups'
import { SimPlayer2D } from '@/components/charts/SimPlayer2D'
import { StackedBar } from '@/components/charts/StackedBar'
import { BOARD_TIME_TONES } from '@/components/charts/chartTones'
import { speedOptions, usePlaybackClock, PLAYBACK_SPEEDS } from '@/components/charts/usePlaybackClock'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Select'
import { traceDuration, type SimulationTrace } from '@/domain'
import { cumulativeCashFlow, DEFAULT_MODEL_NORMS, type HourlyStat, type SimulationRun } from '@/domain'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { sensitivityView } from '@/pages/projects/steps/economics/economicsTables'
import { sensitivityStep } from '@/pages/projects/steps/economics/economicsView'
import { clockOf, TIME_SEGMENTS, timeSegments, tripShare } from '@/pages/projects/steps/simulation/charts/chartsModel'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { ShowcaseSection } from './StateGrid'

const ps = ru.project.simulation
const pe = ru.project.economics
const M = 1_000_000
/** Цель «паллет в срок» по умолчанию (PRD 11.4, этап 2): ниже — нарушение часа. */
const ON_TIME_TARGET = 0.95

const run = (status: string): SimulationRun => {
  const dto = SIMULATION_RUNS.find((r) => r.status === status)
  if (!dto) throw new Error(`Фикстура прогона ${status} не найдена`)
  return toSimulationRun(dto)
}
const confirmed = run('confirmed')
const needMore = run('needs_additions')
const hourLabel = (h: HourlyStat) => String(h.hour).padStart(2, '0')

/** Полоса времени парка по долям состояний прогона (kpis.fleet_shares) — как на вкладке 07a. */
function timeRow(key: string, title: string, shares: SimulationRun['fleetShares'], robots: number, stations: number) {
  const segments = timeSegments(shares)
  return { key, label: ps.time.row(`${title}: ${String(robots)}/${String(stations)}`, formatPercent(segments ? tripShare(segments) : 0)), values: segments ?? {} }
}

const economics = toEconomics(EVALUATION_LP01, 'RB-0008', { conditions: [], operationsPerDay: 2000 })
const raas = economics.scenarios.find((s) => s.acquisition === 'raas')
const cashFlow = raas ? cumulativeCashFlow(raas, economics.horizonYears) : []
const sensitivityRows = raas ? sensitivityView(raas, economics.scenarios.filter((s) => s !== raas), economics, null, DEFAULT_MODEL_NORMS).map((row) => row.range) : []

/** Графики шагов проекта (D-87) на фикстурах: 05, 07a, 08. Свой SVG на токенах, текстовая альтернатива — таблица. */
export function ChartsShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="BarChart · single (05)">
        <BarChart
          label={ps.demand.title}
          categoryLabel={ps.hourly.hour}
          series={[{ key: 'demand', label: ps.demand.series, tone: 'muted' }]}
          highlightTone="strong"
          data={confirmed.hourlyAfter.map((h) => ({ key: hourLabel(h), label: hourLabel(h), values: [h.demand], highlight: h.demand >= confirmed.peak.requiredPerHour }))}
          reference={{ value: confirmed.peak.requiredPerHour, label: ps.demand.reference }}
          formatValue={(v) => formatNumber(v)}
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · paired (07a)">
        <BarChart
          label={ps.load.title}
          categoryLabel={ps.hourly.hour}
          series={[{ key: 'demand', label: ps.load.demand, tone: 'muted' }, { key: 'done', label: ps.load.done, tone: 'strong' }]}
          data={needMore.hourlyBefore.map((h) => ({
            key: hourLabel(h),
            label: hourLabel(h),
            values: [h.demand, h.done],
            highlight: h.demand >= needMore.peak.requiredPerHour,
            violation: h.onTime !== null && h.onTime < ON_TIME_TARGET,
          }))}
          formatValue={(v) => formatNumber(v)}
          height={120}
          legend
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · negative (08)">
        <BarChart
          label={pe.cashFlow.title}
          categoryLabel={pe.cashFlow.yearHeader}
          series={[{ key: 'flow', label: pe.cashFlow.series, tone: 'strong' }]}
          data={cashFlow.map((v, year) => ({ key: String(year), label: pe.cashFlow.year(year), values: [v / M] }))}
          formatValue={(v) => formatNumber(v, 1, { fixed: true, signed: true })}
          showValues
          density="wide"
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · stacked, reference danger, axisLabel (3.2)">
        <BarChart
          label={ps.demand.title}
          categoryLabel={ps.hourly.hour}
          series={[{ key: 'inbound', label: 'приёмка', tone: 'strong' }, { key: 'outbound', label: 'отгрузка', tone: 'secondary' }]}
          stacked
          data={needMore.hourlyBefore.map((h, i) => ({
            key: hourLabel(h),
            label: hourLabel(h),
            axisLabel: i % 6 === 0 || i === needMore.hourlyBefore.length - 1 ? hourLabel(h) : '',
            values: [Math.round(h.demand * INBOUND_SHARE), h.demand - Math.round(h.demand * INBOUND_SHARE)],
          }))}
          reference={{ value: needMore.peak.requiredPerHour, label: ps.demand.reference, tone: 'danger' }}
          formatValue={(v) => formatNumber(v)}
          height={120}
          legend
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · 3 серии, axis, peakMark, legendPosition=left (3.5)">
        <BoardLoadChart />
      </ShowcaseSection>
      <ShowcaseSection title="ChartLegend · markers, detail, layout=column">
        <div className="flex flex-wrap gap-40">
          <ChartLegend series={LOAD_LEGEND} layout="column" />
          <ChartLegend series={boardRobotLegend(BOARD_LEGEND_LABELS)} />
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="HourlyTable · groups, violation=outline, onlyDiffering + toggle (3.5)">
        <BoardHourlyTable />
      </ShowcaseSection>
      <ShowcaseSection title="SimPlayer2D look=board · PlaybackTimeline · скорость ×600 (3.5)">
        <BoardPlayers />
      </ShowcaseSection>
      <ShowcaseSection title="StackedBar (07a)">
        <StackedBar
          label={ps.time.title}
          segments={TIME_SEGMENTS}
          formatShare={(s) => formatPercent(s)}
          rows={[
            timeRow('before', ps.charts.from.matching, needMore.before.fleetShares, needMore.from.robots, needMore.from.stations),
            timeRow('after', ps.charts.to.need_more, needMore.fleetShares, needMore.to.robots, needMore.to.stations),
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="StackedBar · tones=BOARD_TIME_TONES, legendShape=dot (3.5)">
        <StackedBar
          label={ps.time.title}
          segments={TIME_SEGMENTS}
          tones={BOARD_TIME_TONES}
          legendShape="dot"
          formatShare={(s) => formatPercent(s)}
          rows={[
            timeRow('before', ps.charts.from.matching, needMore.before.fleetShares, needMore.from.robots, needMore.from.stations),
            timeRow('after', ps.charts.to.need_more, needMore.fleetShares, needMore.to.robots, needMore.to.stations),
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="RangeBar (08)">
        <RangeBar
          label={pe.sensitivity.title(sensitivityStep(DEFAULT_MODEL_NORMS.sensitivityShift))}
          valueLabel={pe.sensitivity.valueLabel}
          rows={sensitivityRows}
        />
      </ShowcaseSection>
    </div>
  )
}

/** Доля приёмки в потребности — только для витрины стопки (в фикстуре прогона потребность одной суммой). */
const INBOUND_SHARE = 0.6
const DEMAND_SERIES = { key: 'demand', label: 'Потребность', tone: 'muted' } as const
const FROM_SERIES = { key: 'from', label: `Из подбора · ${String(needMore.from.robots)} / ${String(needMore.from.stations)}`, tone: 'strong' } as const
const TO_SERIES = { key: 'to', label: `С изменениями · ${String(needMore.to.robots)} / ${String(needMore.to.stations)}`, tone: 'accent' } as const
const LOAD_SERIES = [DEMAND_SERIES, FROM_SERIES, TO_SERIES]
const peakOf = (hours: readonly HourlyStat[]) => Math.max(...hours.filter((h) => h.demand >= needMore.peak.requiredPerHour).map((h) => h.done), 0)
const LOAD_LEGEND: readonly LegendItem[] = [
  { ...DEMAND_SERIES, detail: 'рейсов в час' },
  { ...FROM_SERIES, detail: `в пик ${String(peakOf(needMore.hourlyBefore))} из ${String(needMore.peak.requiredPerHour)} рейсов` },
  { ...TO_SERIES, detail: `в пик ${String(peakOf(needMore.hourlyAfter))} из ${String(needMore.peak.requiredPerHour)} рейсов` },
  { key: 'peak', label: 'Пиковый час', tone: 'strong', marker: 'dash' },
  { key: 'violation', label: 'Красная рамка', detail: 'ниже требования к сервису', tone: 'danger', marker: 'frame' },
]
const BOARD_LEGEND_LABELS = { idle: 'свободен', toPickup: 'едет за паллетой', loaded: 'с паллетой', station: 'зарядная станция', queue: 'в очереди к станции' }

function BoardLoadChart() {
  const peak = needMore.peak.requiredPerHour
  return (
    <BarChart
      label={ps.load.title}
      categoryLabel={ps.hourly.hour}
      series={LOAD_SERIES}
      data={needMore.hourlyBefore.map((h, i) => {
        const after = needMore.hourlyAfter[i]
        return {
          key: hourLabel(h),
          label: hourLabel(h),
          values: [h.demand, h.done, after?.done ?? 0],
          highlight: h.demand >= peak,
          violation: h.onTime !== null && h.onTime < ON_TIME_TARGET,
        }
      })}
      formatValue={(v) => formatNumber(v)}
      height={96}
      axis={{ ticks: [0, peak / 2, peak], unit: 'рейсов в час' }}
      peakMark
      legend
      legendPosition="left"
      legendItems={LOAD_LEGEND}
    />
  )
}

const cellsOf = (hours: readonly HourlyStat[], pick: (h: HourlyStat) => number | null, violated?: (h: HourlyStat) => boolean) =>
  hours.map((h) => {
    const v = pick(h)
    return { value: v === null ? '—' : formatNumber(v, 1), violation: violated?.(h) ?? false }
  })
const pairRows = (key: string, pick: (h: HourlyStat) => number | null, violated?: (h: HourlyStat) => boolean): readonly HourlyTableRow[] => [
  { key: `${key}-from`, label: 'Из подбора', cells: cellsOf(needMore.hourlyBefore, pick, violated) },
  { key: `${key}-to`, label: 'С изменениями', cells: cellsOf(needMore.hourlyAfter, pick, violated) },
]
const HOURLY_GROUPS: readonly HourlyTableGroup[] = [
  {
    key: 'load',
    title: 'Нагрузка на парк',
    metrics: [
      { key: 'idle', label: 'Свободны, роботов', rows: pairRows('idle', (h) => h.idle) },
      { key: 'queue', label: 'Очередь к станции, роботов', rows: pairRows('queue', (h) => h.waitingCharger) },
      { key: 'charging', label: 'На зарядке, роботов', rows: pairRows('charging', (h) => h.charging) },
      // Одинаковые строки у обоих составов — фильтр различий их прячет.
      { key: 'same', label: 'Потребность, рейсов (копия)', rows: pairRows('same', (h) => h.hour) },
    ],
  },
  {
    key: 'result',
    title: 'Результат',
    metrics: [
      { key: 'done', label: 'Выполнено, рейсов', requirement: 'требование — вся потребность часа', rows: pairRows('done', (h) => h.done, (h) => h.done < h.demand) },
      { key: 'onTime', label: 'Паллет в срок, %', requirement: 'требование — от 95 %', rows: pairRows('onTime', (h) => (h.onTime === null ? null : h.onTime * 100), (h) => h.onTime !== null && h.onTime < ON_TIME_TARGET) },
    ],
  },
]

function BoardHourlyTable() {
  return (
    <div className="rounded-lg bg-surface-sunken p-16">
      <h3 id="board-hourly" className="sr-only">{ps.hourly.caption}</h3>
      <HourlyTable
        labelledBy="board-hourly"
        categoryLabel={ps.hourly.hour}
        columns={needMore.hourlyBefore.map(hourLabel)}
        rows={[{ key: 'demand', label: ps.hourly.demand, cells: needMore.hourlyBefore.map((h) => ({ value: formatNumber(h.demand) })) }]}
        groups={HOURLY_GROUPS}
        violation="outline"
        violationLabel={ps.hourly.violation}
        onlyDiffering
        toggle={{ showAll: (n) => `Показать все строки · ${String(n)}`, onlyDiffering: 'Только различия' }}
      />
    </div>
  )
}

const TICKS = [0, 6, 12, 18, 24].map((h) => ({ at: h * 3600, label: String(h).padStart(2, '0') }))

/** Два плеера доски с общими часами: трассы — почасовой срез фикстуры (как у кадра отчёта 09), грузятся лениво. */
function BoardPlayers() {
  const [traces, setTraces] = useState<readonly SimulationTrace[]>([])
  useEffect(() => {
    let alive = true
    void Promise.all([import('@/mocks/fixtures/traces/demo-18-6.hourly.json'), import('@/mocks/fixtures/traces/demo-16-5.hourly.json')])
      .then((modules) => { if (alive) setTraces(modules.map((m) => toSimulationTrace(m.default))) })
    return () => { alive = false }
  }, [])
  const duration = Math.max(0, ...traces.map(traceDuration))
  const clock = usePlaybackClock(duration, 0, PLAYBACK_SPEEDS[1])
  const offset = traces[0]?.clockOffsetH ?? 0
  const now = clockOf(offset, clock.t)
  if (traces.length === 0) return null
  const demand = Array.from({ length: 24 }, (_, i) => needMore.hourlyBefore.find((h) => h.hour === (offset + i) % 24)?.demand ?? 0)
  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-wrap items-center gap-16">
        <span className="type-title-sm text-text tabular-nums">{now.label}</span>
        <IconButton size={36} label={clock.playing ? 'Пауза' : 'Пуск'} icon={clock.playing ? Pause : Play} onClick={clock.playing ? clock.pause : clock.play} />
        <IconButton size={36} label="Сначала" icon={RotateCcw} onClick={clock.toStart} />
        <PlaybackTimeline className="flex-1" label="Время дня" valueText={now.label} max={duration} step={60} value={clock.t} onValueChange={clock.seek} bars={demand} ticks={TICKS} />
        <Select variant="filter" aria-label="Скорость воспроизведения" options={speedOptions()} value={String(clock.speed)}
          onChange={(v) => { const x = PLAYBACK_SPEEDS.find((sp) => String(sp) === v); if (x !== undefined) clock.setSpeed(x) }} />
      </div>
      <ChartLegend series={boardRobotLegend(BOARD_LEGEND_LABELS)} />
      <div className="flex flex-wrap gap-16">
        {traces.map((trace) => (
          <SimPlayer2D key={trace.name} look="board" trace={trace} t={clock.t} title={trace.name} gates={{ inbound: 'П', outbound: 'О' }}
            renderStats={(byState) => <p className="type-caption text-text-secondary">{JSON.stringify(byState)}</p>} />
        ))}
      </div>
      <PlaybackTimeline label="Время дня (недоступно)" valueText={now.label} max={duration} value={clock.t} onValueChange={clock.seek} bars={demand} ticks={TICKS} disabled />
    </div>
  )
}
