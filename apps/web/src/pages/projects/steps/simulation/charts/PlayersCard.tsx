import { Pause, Play, RotateCcw } from 'lucide-react'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { PlaybackTimeline } from '@/components/charts/PlaybackTimeline'
import { boardRobotLegend, groupOf } from '@/components/charts/robotGroups'
import { SimPlayer2D } from '@/components/charts/SimPlayer2D'
import { PLAYBACK_SPEEDS, speedOptions, usePlaybackClock } from '@/components/charts/usePlaybackClock'
import { Card, CardTitle } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Select'
import { ErrorState, EmptyState, Skeleton } from '@/components/ui/States'
import { traceDuration, type HourlyStat, type RobotState, type SimulationRun, type SimulationTrace } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { clockOf, hourLabel, initialTime, isPeakHour, type ChartFleet } from './chartsModel'
import { useRunTraces } from './useRunTraces'

const t = ru.project.simulation.player
const LEGEND = boardRobotLegend(t.board)
const HOURS_PER_DAY = 24
const SECONDS_PER_HOUR = 3600
/** Подписи шкалы через 6 часов по часам объекта от начала записи: 07 · 13 · 19 · 01 · 07 (на макете запись с 00, 17085:8). */
const TICK_STEP_H = 6
/** По умолчанию — «Сутки за 2 мин 24 с» (×600, 17083:1232). */
const DEFAULT_SPEED = PLAYBACK_SPEEDS[1]

/** Плеер — состав с трассой: по числу роботов и станций, иначе по порядку (из подбора, затем итоговая). */
interface Pairing {
  readonly fleet: ChartFleet
  readonly trace: SimulationTrace
}

function pair(fleets: readonly ChartFleet[], traces: readonly SimulationTrace[]): readonly Pairing[] {
  return fleets.flatMap((fleet, i) => {
    const trace = traces.find((tr) => tr.robots === fleet.fleet.robots && tr.chargers === fleet.fleet.stations) ?? traces[i]
    return trace ? [{ fleet, trace }] : []
  })
}

/** «На схеме в 08:12» (17040:761): роботы — из кадра записи, паллеты — из часа прогона. */
function PlayerStats({ byState, robots, hour, time }: { readonly byState: Readonly<Record<RobotState, number>>; readonly robots: number; readonly hour: HourlyStat | undefined; readonly time: string }) {
  const count = (pick: (state: RobotState) => boolean) => Object.entries(byState).filter(([s]) => pick(s)).reduce((sum, [, n]) => sum + n, 0)
  const s = t.stats
  const rows = [
    { key: 'working', label: s.working, value: s.workingValue(count((st) => groupOf(st) === 'work'), robots) },
    { key: 'idle', label: s.idle, value: formatNumber(count((st) => groupOf(st) === 'idle')) },
    { key: 'charging', label: s.charging, value: s.chargingValue(count((st) => st === 'to_charger' || st === 'charging'), count((st) => st === 'wait_charger')) },
    { key: 'backlog', label: s.backlog, value: hour ? formatNumber(hour.backlogMax) : '—' },
    { key: 'onTime', label: s.onTime, value: hour?.onTime == null ? '—' : formatPercent(hour.onTime) },
  ]
  return (
    <div className="flex flex-col gap-8">
      <CardTitle>{s.title(time)}</CardTitle>
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-8 border-b border-border py-8 type-caption last:border-b-0">
            <dt className="text-text-secondary">{r.label}</dt>
            <dd className="font-semibold text-text tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Players({ run, pairs }: { readonly run: SimulationRun; readonly pairs: readonly Pairing[] }) {
  const first = pairs[0]
  const duration = Math.max(...pairs.map((p) => traceDuration(p.trace)))
  const offset = first?.trace.clockOffsetH ?? 0
  const clock = usePlaybackClock(duration, first ? initialTime(offset, first.fleet.hours, run, duration) : 0, DEFAULT_SPEED)
  const now = clockOf(offset, clock.t)
  const hourOf = (fleet: ChartFleet) => fleet.hours.find((h) => h.hour === now.hour)
  const current = first ? hourOf(first.fleet) : undefined
  // Столбики шкалы — потребность часов записи по порядку от её начала.
  const bars = Array.from({ length: HOURS_PER_DAY }, (_, i) => first?.fleet.hours.find((h) => h.hour === (offset + i) % HOURS_PER_DAY)?.demand ?? 0)
  // Деление за концом записи (запись короче суток) не рисуем — подпись выехала бы за шкалу.
  const ticks = Array.from({ length: HOURS_PER_DAY / TICK_STEP_H + 1 }, (_, k) => ({
    at: k * TICK_STEP_H * SECONDS_PER_HOUR,
    label: hourLabel((offset + k * TICK_STEP_H) % HOURS_PER_DAY),
  })).filter((tick) => tick.at <= duration)
  return (
    <>
      <div className="flex flex-wrap items-center gap-16">
        <span className="flex min-w-72 flex-col">
          <span role="timer" aria-label={t.timeline} className="type-title-md text-text tabular-nums">{now.label}</span>
          <span className="type-caption text-text-secondary">{current && isPeakHour(current, run) ? t.peakHour : ' '}</span>
        </span>
        <IconButton size={36} label={clock.playing ? t.pause : t.play} icon={clock.playing ? Pause : Play} onClick={clock.playing ? clock.pause : clock.play} />
        <IconButton size={36} label={t.toStart} icon={RotateCcw} onClick={clock.toStart} />
        <PlaybackTimeline
          className="min-w-0 flex-1"
          label={t.timeline}
          valueText={now.label}
          max={duration}
          step={first?.trace.stepS ?? 1}
          value={clock.t}
          onValueChange={clock.seek}
          bars={bars}
          ticks={ticks}
        />
        <Select
          variant="filter"
          aria-label={t.speed}
          options={speedOptions()}
          value={String(clock.speed)}
          onChange={(v) => {
            const speed = PLAYBACK_SPEEDS.find((x) => String(x) === v)
            if (speed !== undefined) clock.setSpeed(speed)
          }}
        />
      </div>
      <ChartLegend series={LEGEND} />
      {/* Один состав («подтверждено») — схема на всю ширину: пустая правая половина читалась как пропавший плеер. */}
      <div className={pairs.length > 1 ? 'grid grid-cols-2 gap-16' : 'grid grid-cols-1 gap-16'}>
        {pairs.map(({ fleet, trace }) => (
          <SimPlayer2D
            key={fleet.key}
            look="board"
            trace={trace}
            t={clock.t}
            title={ru.project.simulation.charts.short(fleet.title, fleet.fleet.robots, fleet.fleet.stations)}
            gates={t.gates}
            renderStats={(byState) => <PlayerStats byState={byState} robots={trace.robots} hour={hourOf(fleet)} time={now.label} />}
          />
        ))}
      </div>
    </>
  )
}

/**
 * «2D-сравнение: один и тот же смоделированный день» (3.5, 17040:667; PRD 11.4, ТЗ 3.6.1–3.6.3): два плеера записанных
 * прогонов с общим временем, на паузе в начале первого пикового часа (D-105). `data-players="ready"` — схемы с роботами
 * нарисованы: по нему эталон ждёт готовности.
 */
export function PlayersCard({ run, fleets }: { readonly run: SimulationRun; readonly fleets: readonly ChartFleet[] }) {
  const { load, retry } = useRunTraces(run.id)
  const pairs = load.status === 'ready' ? pair(fleets, load.traces) : []
  return (
    <Card padding={28} gap={20} aria-labelledby="charts-player-title" data-players={pairs.length > 0 ? 'ready' : load.status}>
      <div className="flex flex-col gap-4">
        <h2 id="charts-player-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{fleets.length > 1 ? t.lead : t.leadSingle}</p>
      </div>
      {load.status === 'loading' && <div aria-busy="true"><Skeleton className="h-(--rav-player-field-height)" /></div>}
      {load.status === 'error' && <ErrorState title={ru.project.simulation.charts.tracesError.title} message={ru.project.simulation.charts.tracesError.message} onRetry={retry} />}
      {load.status === 'ready' && pairs.length === 0 && (
        <EmptyState title={ru.project.simulation.charts.noTraces.title} description={ru.project.simulation.charts.noTraces.description} />
      )}
      {pairs.length > 0 && <Players run={run} pairs={pairs} />}
    </Card>
  )
}
