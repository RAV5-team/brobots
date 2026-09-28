import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { traceDuration, type SimulationTrace } from '@/domain'
import { useServices } from '@/services/useServices'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { frameStats, recordFrames, type FrameStats } from './frameStats'
import { TracePlayer } from './TracePlayer'
import { PLAYBACK_SPEEDS, usePlaybackClock, type PlaybackSpeed } from './usePlaybackClock'

const t = ru.dev.spike2d
/** Прогон «можно уменьшить»: две трассы — из подбора 18/6 и рекомендация 16/5. */
const RUN_ID = 'SIM-0926-02'
const MEASURE_MS = 10_000
const MEASURE_SPEED: PlaybackSpeed = 1800
const MIN_FPS = 30
const SECONDS_PER_HOUR = 3600

declare global {
  interface Window {
    /** Итог замера для скрипта e2e/measureSpike2d.ts. */
    __spike2d?: FrameStats
  }
}

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly traces: readonly SimulationTrace[] }

/** Часы объекта: «08:12» — от начала смены записи. */
function clockLabel(trace: SimulationTrace | undefined, seconds: number): string {
  const total = ((trace?.clockOffsetH ?? 0) * SECONDS_PER_HOUR + seconds) % (24 * SECONDS_PER_HOUR)
  const h = Math.floor(total / SECONDS_PER_HOUR)
  const m = Math.floor((total % SECONDS_PER_HOUR) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** /dev/spike-2d — спайк 2D-плеера 07a (D-87): два плеера с общим временем и замер частоты кадров. */
export function Spike2dPage() {
  const services = useServices()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    services.projects.getSimulationTraces(RUN_ID)
      .then((traces) => { if (!cancelled) setState({ status: 'ready', traces }) })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить трассы', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services])

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-24 px-40 py-40">
      <header className="flex flex-col gap-8">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>
      {state.status === 'loading' && <div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>}
      {state.status === 'error' && <ErrorState title={t.error} message={t.loading} onRetry={() => { window.location.reload() }} />}
      {state.status === 'ready' && <Players traces={state.traces} />}
    </main>
  )
}

function Players({ traces }: { readonly traces: readonly SimulationTrace[] }) {
  const duration = Math.max(...traces.map(traceDuration))
  const clock = usePlaybackClock(duration)
  const [measuring, setMeasuring] = useState(false)
  const [stats, setStats] = useState<FrameStats | null>(null)

  const measure = async () => {
    setMeasuring(true)
    setStats(null)
    clock.setSpeed(MEASURE_SPEED)
    clock.toStart()
    clock.play()
    const result = frameStats(await recordFrames(MEASURE_MS))
    window.__spike2d = result
    setStats(result)
    setMeasuring(false)
  }

  return (
    <section className="flex flex-col gap-16 rounded-2xl bg-bg p-24 shadow-raised-md">
      <div className="flex flex-wrap items-center gap-12">
        <span className="type-title-sm tabular-nums text-text">{clockLabel(traces[0], clock.t)}</span>
        <Button onClick={clock.playing ? clock.pause : clock.play}>{clock.playing ? t.pause : t.play}</Button>
        <Button onClick={clock.toStart}>{t.toStart}</Button>
        <Segmented
          label={t.speed}
          fit="content"
          value={String(clock.speed)}
          onChange={(v) => { clock.setSpeed(Number(v) as PlaybackSpeed) }}
          options={PLAYBACK_SPEEDS.map((x) => ({ value: String(x), label: t.speedOption(x) }))}
        />
        <Button variant="primary" disabled={measuring} onClick={() => { void measure() }}>{measuring ? t.measuring : t.measure}</Button>
      </div>
      <input
        type="range"
        aria-label={t.timeline}
        aria-valuetext={clockLabel(traces[0], clock.t)}
        min={0}
        max={duration}
        step={traces[0]?.stepS ?? 1}
        value={clock.t}
        onChange={(e) => { clock.seek(Number(e.target.value)) }}
        className="w-full accent-inverse"
      />
      <div className="flex gap-24">
        {traces.map((trace) => <TracePlayer key={trace.name} trace={trace} t={clock.t} />)}
      </div>
      <output data-testid="spike-result" className="type-body text-text">
        {stats && `${t.result(formatNumber(stats.fps, 1), formatNumber(stats.p95FrameMs, 1), stats.longFrames, stats.frames)} — ${stats.fps >= MIN_FPS ? t.passed : t.failed}`}
      </output>
    </section>
  )
}
