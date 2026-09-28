import { Pause, Play, RotateCcw } from 'lucide-react'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { groupOf, robotLegend } from '@/components/charts/robotGroups'
import { SimPlayer2D } from '@/components/charts/SimPlayer2D'
import { PLAYBACK_SPEEDS, usePlaybackClock } from '@/components/charts/usePlaybackClock'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Segmented } from '@/components/ui/Segmented'
import { Slider } from '@/components/ui/Slider'
import { ErrorState, EmptyState, Skeleton } from '@/components/ui/States'
import { traceDuration, type HourlyStat, type RobotState, type SimulationRun, type SimulationTrace } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { clockOf, fleetCaption, initialTime, isPeakHour, type ChartFleet } from './chartsModel'
import { useRunTraces } from './useRunTraces'

const t = ru.project.simulation.player
const LEGEND = robotLegend(t.groups)

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

function PlayerStats({ byState, robots, hour }: { readonly byState: Readonly<Record<RobotState, number>>; readonly robots: number; readonly hour: HourlyStat | undefined }) {
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
    <dl className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.key} className="flex items-baseline justify-between gap-8 type-caption">
          <dt className="text-text-secondary">{r.label}</dt>
          <dd className="font-medium text-text tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Players({ run, pairs }: { readonly run: SimulationRun; readonly pairs: readonly Pairing[] }) {
  const first = pairs[0]
  const duration = Math.max(...pairs.map((p) => traceDuration(p.trace)))
  const offset = first?.trace.clockOffsetH ?? 0
  const clock = usePlaybackClock(duration, first ? initialTime(offset, first.fleet.hours, run, duration) : 0)
  const now = clockOf(offset, clock.t)
  const peak = first?.fleet.hours.find((h) => h.hour === now.hour)
  return (
    <>
      <div className="flex flex-wrap items-center gap-12">
        <span className="flex items-center gap-12">
          <span role="timer" aria-label={t.timeline} className="type-heading font-semibold text-text tabular-nums">{now.label}</span>
          {peak && isPeakHour(peak, run) && <Chip tone="muted">{t.peakHour}</Chip>}
        </span>
        <Button variant={clock.playing ? 'primary' : undefined} onClick={clock.playing ? clock.pause : clock.play}>
          {clock.playing ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
          {clock.playing ? t.pause : t.play}
        </Button>
        <Button onClick={clock.toStart}><RotateCcw aria-hidden size={16} />{t.toStart}</Button>
        <Segmented
          label={t.speed}
          fit="content"
          value={String(clock.speed)}
          onChange={(v) => {
            const speed = PLAYBACK_SPEEDS.find((x) => String(x) === v)
            if (speed !== undefined) clock.setSpeed(speed)
          }}
          options={PLAYBACK_SPEEDS.map((x) => ({ value: String(x), label: t.speedOption(x) }))}
        />
      </div>
      <Slider label={t.timeline} valueText={now.label} min={0} max={duration} step={first?.trace.stepS ?? 1} value={clock.t} onValueChange={clock.seek} />
      <div className="flex flex-wrap gap-16">
        {pairs.map(({ fleet, trace }) => (
          <SimPlayer2D
            key={fleet.key}
            trace={trace}
            t={clock.t}
            title={fleetCaption(fleet)}
            zones={{ inbound: t.zones.inbound, outbound: t.zones.outbound, chargers: t.zones.chargers(trace.chargers) }}
            renderStats={(byState) => <PlayerStats byState={byState} robots={trace.robots} hour={fleet.hours.find((h) => h.hour === now.hour)} />}
          />
        ))}
      </div>
      <ChartLegend series={LEGEND} shape="dot" />
    </>
  )
}

/** «Воспроизведение дня · 2D» (16198:716): два плеера записанных прогонов с общим временем (PRD 11.4, ТЗ 3.6.1–3.6.3). */
export function PlayersCard({ run, fleets }: { readonly run: SimulationRun; readonly fleets: readonly ChartFleet[] }) {
  const { load, retry } = useRunTraces(run.id)
  const pairs = load.status === 'ready' ? pair(fleets, load.traces) : []
  return (
    <Card padding={24} aria-labelledby="charts-player-title">
      <div className="flex flex-col gap-4">
        <h2 id="charts-player-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{t.lead}</p>
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
