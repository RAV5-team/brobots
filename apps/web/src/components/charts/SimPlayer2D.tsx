import { memo, useMemo, type ReactNode } from 'react'
import { countStates, positionsAt, type RobotState, type SimulationTrace, type TraceNode } from '@/domain'
import { TONE_FILL } from './chartTones'
import { GROUP_TONE, groupOf } from './robotGroups'

const PAD_M = 3
const ROBOT_R_M = 1.4
const DOCK_M = 3

/** Рамка схемы в метрах; схема повёрнута: длинная сторона склада — по горизонтали, как на макете 07a. */
function frameOf(trace: SimulationTrace) {
  const xs = [...trace.layout.nodes.map((n) => n.x), ...trace.layout.chargerSlots.map(([x]) => x)]
  const ys = [...trace.layout.nodes.map((n) => n.y), ...trace.layout.chargerSlots.map(([, y]) => y)]
  const minX = Math.min(...xs) - PAD_M
  const minY = Math.min(...ys) - PAD_M
  const width = Math.max(...ys) + PAD_M - minY
  const height = Math.max(...xs) + PAD_M - minX
  return { minX, minY, width, height, viewBox: `${String(minY)} ${String(minX)} ${String(width)} ${String(height)}` }
}

type Frame = ReturnType<typeof frameOf>

/** Подпись зоны: слева от схемы — справа от самой правой точки зоны, по середине её высоты; в процентах поля. */
function zoneLabelAt(frame: Frame, points: readonly (readonly [number, number])[]) {
  if (points.length === 0) return null
  const right = Math.max(...points.map(([, y]) => y)) + DOCK_M
  const middle = (Math.min(...points.map(([x]) => x)) + Math.max(...points.map(([x]) => x))) / 2
  return { left: `${String(((right - frame.minY) / frame.width) * 100)}%`, top: `${String(((middle - frame.minX) / frame.height) * 100)}%` }
}

const pointsOf = (nodes: readonly TraceNode[], type: TraceNode['type']) => nodes.filter((n) => n.type === type).map((n) => [n.x, n.y] as const)

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
      {trace.layout.nodes.filter((n) => n.type !== 'junction').map((n) => {
        const dock = n.type === 'dock_in' || n.type === 'dock_out'
        const size = dock ? DOCK_M : 2
        return (
          <rect key={n.id} x={n.y - size / 2} y={n.x - size / 2} width={size} height={size} rx={0.4}
            className={n.type === 'storage' ? 'fill-surface-sunken' : n.type === 'charger' ? 'fill-accent' : 'fill-border-strong'} />
        )
      })}
      {trace.layout.chargerSlots.map(([x, y], i) => <rect key={i} x={y - 1.2} y={x - 1.2} width={2.4} height={2.4} rx={0.4} className="fill-accent-surface" />)}
    </g>
  )
})

/** Подписи зон схемы вызывающего: «Приёмка», «Отгрузка», «Зарядные станции · 6». */
export interface ZoneLabels {
  readonly inbound: string
  readonly outbound: string
  readonly chargers: string
}

interface SimPlayer2DProps {
  readonly trace: SimulationTrace
  /** Общее время плееров, с от начала записи. */
  readonly t: number
  /** Подпись плеера: «Из подбора: 18 роботов, 6 станций». */
  readonly title: string
  readonly zones: ZoneLabels
  /** Сводка под схемой по роботам кадра `{ состояние: число }` — считает вызывающий, плеер только отдаёт кадр. */
  readonly renderStats: (byState: Readonly<Record<RobotState, number>>) => ReactNode
}

/**
 * 2D-плеер записанного прогона (components.md: SimPlayer2D; 07a, 16198:734; D-87, D-105): SVG-схема рисуется один раз,
 * поверх — роботы кружками по состояниям в момент `t`. Плеер ничего не пересчитывает: позиции — кадры трассы,
 * между кадрами — линейная интерполяция. Время двигает `usePlaybackClock`, общий для плееров.
 */
export function SimPlayer2D({ trace, t: time, title, zones, renderStats }: SimPlayer2DProps) {
  const frame = useMemo(() => frameOf(trace), [trace])
  const labels = useMemo(() => [
    { key: 'inbound', text: zones.inbound, at: zoneLabelAt(frame, pointsOf(trace.layout.nodes, 'dock_in')) },
    { key: 'outbound', text: zones.outbound, at: zoneLabelAt(frame, pointsOf(trace.layout.nodes, 'dock_out')) },
    { key: 'chargers', text: zones.chargers, at: zoneLabelAt(frame, trace.layout.chargerSlots) },
  ], [frame, trace, zones])
  const positions = positionsAt(trace, time)
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-10">
      <figcaption className="type-body-sm font-medium text-text">{title}</figcaption>
      <div className="flex h-(--rav-player-field-height) items-center justify-center overflow-hidden rounded-lg bg-surface-muted p-12 shadow-inset-md">
        <div className="relative h-full max-w-full" style={{ aspectRatio: `${String(frame.width)} / ${String(frame.height)}` }}>
          <svg viewBox={frame.viewBox} role="img" aria-label={title} className="absolute inset-0 size-full">
            <LayoutLayer trace={trace} />
            <g>
              {positions.map((p, i) => (
                <circle key={i} data-robot={groupOf(p.state)} cx={p.y} cy={p.x} r={ROBOT_R_M} className={TONE_FILL[GROUP_TONE[groupOf(p.state)]]} />
              ))}
            </g>
          </svg>
          {labels.map(({ key, text, at }) => at && (
            <span key={key} aria-hidden className="absolute -translate-y-1/2 pl-4 type-caption-xs font-medium whitespace-nowrap text-text-secondary" style={at}>
              {text}
            </span>
          ))}
        </div>
      </div>
      {renderStats(countStates(positions))}
    </figure>
  )
}
