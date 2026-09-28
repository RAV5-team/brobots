import { clsx } from 'clsx'
import { memo, useMemo } from 'react'
import { TONE_FILL, TONE_SWATCH, type ChartTone } from '@/components/charts/chartTones'
import { countStates, positionsAt, type SimulationTrace } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.dev.spike2d

/** Группы состояний робота для цвета и сводки — тона графиков (D-87), не цвета сервиса. */
type StateGroup = keyof typeof t.groups
const GROUP_OF: Readonly<Record<string, StateGroup>> = {
  to_pickup: 'work', loading: 'work', to_drop: 'work', unloading: 'work',
  blocked: 'waiting', queue: 'waiting', wait_charger: 'waiting',
  to_charger: 'charging', charging: 'charging',
  down: 'down', towed: 'down',
  idle: 'idle',
}
const GROUP_TONE: Readonly<Record<StateGroup, ChartTone>> = {
  work: 'strong', waiting: 'danger', charging: 'accent', down: 'danger-soft', idle: 'subtle',
}
const STATE_GROUPS = Object.keys(GROUP_TONE) as StateGroup[]

const PAD_M = 3
const ROBOT_R_M = 1.4

/** Рамка схемы в метрах; схема повёрнута: длинная сторона склада — по горизонтали, как на макете 07a. */
function frameOf(trace: SimulationTrace) {
  const xs = [...trace.layout.nodes.map((n) => n.x), ...trace.layout.chargerSlots.map(([x]) => x)]
  const ys = [...trace.layout.nodes.map((n) => n.y), ...trace.layout.chargerSlots.map(([, y]) => y)]
  const minX = Math.min(...xs) - PAD_M
  const minY = Math.min(...ys) - PAD_M
  return { viewBox: `${String(minY)} ${String(minX)} ${String(Math.max(...ys) + PAD_M - minY)} ${String(Math.max(...xs) + PAD_M - minX)}` }
}

/** Схема склада — рисуется один раз: рёбра, хранение, доки, слоты зарядки. */
const LayoutLayer = memo(function LayoutLayer({ trace }: { readonly trace: SimulationTrace }) {
  const xy = useMemo(() => new Map(trace.layout.nodes.map((n) => [n.id, n])), [trace])
  return (
    <g>
      {trace.layout.edges.map((e) => {
        const a = xy.get(e.from)
        const b = xy.get(e.to)
        if (!a || !b) return null
        return <line key={`${e.from}-${e.to}`} x1={a.y} y1={a.x} x2={b.y} y2={b.x} className="stroke-border" strokeWidth={e.kind === 'main' ? 1.2 : 0.6} />
      })}
      {trace.layout.nodes.filter((n) => n.type !== 'junction').map((n) => (
        <rect key={n.id} x={n.y - 1} y={n.x - 1} width={2} height={2} rx={0.4}
          className={n.type === 'storage' ? 'fill-surface-sunken' : n.type === 'charger' ? 'fill-accent' : 'fill-border-control'} />
      ))}
      {trace.layout.chargerSlots.map(([x, y], i) => <rect key={i} x={y - 1.2} y={x - 1.2} width={2.4} height={2.4} rx={0.4} className="fill-accent-surface" />)}
    </g>
  )
})

interface TracePlayerProps {
  readonly trace: SimulationTrace
  /** Общее время плееров, с от начала записи. */
  readonly t: number
}

/** Плеер одного прогона: схема и роботы по состояниям; сводка по группам под схемой. */
export function TracePlayer({ trace, t: time }: TracePlayerProps) {
  const { viewBox } = useMemo(() => frameOf(trace), [trace])
  const positions = positionsAt(trace, time)
  const byState = countStates(positions)
  const byGroup = STATE_GROUPS.map((g) => ({
    group: g,
    count: Object.entries(byState).filter(([state]) => (GROUP_OF[state] ?? 'idle') === g).reduce((sum, [, n]) => sum + n, 0),
  }))
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-8">
      <figcaption className="type-body font-semibold text-text">{trace.name}</figcaption>
      <svg viewBox={viewBox} role="img" aria-label={trace.name} className="w-full rounded-lg bg-surface-muted shadow-inset-md">
        <LayoutLayer trace={trace} />
        <g>
          {positions.map((p, i) => (
            <circle key={i} cx={p.y} cy={p.x} r={ROBOT_R_M} className={TONE_FILL[GROUP_TONE[GROUP_OF[p.state] ?? 'idle']]} />
          ))}
        </g>
      </svg>
      <dl className="flex flex-col">
        {byGroup.map(({ group, count }) => (
          <div key={group} className="flex items-center justify-between gap-8 py-2 type-caption">
            <dt className="flex items-center gap-6 text-text-secondary">
              <span aria-hidden className={clsx('size-8 rounded-full', TONE_SWATCH[GROUP_TONE[group]])} />
              {t.groups[group]}
            </dt>
            <dd className="font-semibold text-text tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}
