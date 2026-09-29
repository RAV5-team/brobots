import { clsx } from 'clsx'
import { memo, useMemo, type ReactNode } from 'react'
import { countStates, positionsAt, type RobotState, type SimulationTrace, type TraceNode } from '@/domain'
import { TONE_FILL, TONE_STROKE } from './chartTones'
import { BOARD_ROBOT_LOOK, boardGroupOf, GROUP_TONE, groupOf } from './robotGroups'

const PAD_M = 3
const ROBOT_R_M = 1.4
const DOCK_M = 3
/** Доска 16325: ворота-пилюли, станции-ромбы, фигуры роботов — в метрах схемы. */
const GATE_W_M = 4.4
const GATE_H_M = 3
const GATE_FONT_M = 2
const STATION_M = 2.2
const ROBOT_SQUARE_M = 2.4
const RING_STROKE_M = 0.5
const ROBOT_SQUARE_RADIUS_M = 0.3

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

/** Буквы ворот доски: «П» — приёмка, «О» — отгрузка. */
export interface GateLetters {
  readonly inbound: string
  readonly outbound: string
}

/** Схема по доске 16325 (3.5): проезды линиями, ворота пилюлями с буквой, слоты зарядки ромбами; хранение не рисуется. */
const BoardLayoutLayer = memo(function BoardLayoutLayer({ trace, gates }: { readonly trace: SimulationTrace; readonly gates: GateLetters }) {
  const xy = useMemo(() => new Map(trace.layout.nodes.map((n) => [n.id, n])), [trace])
  const docks = trace.layout.nodes.filter((n) => n.type === 'dock_in' || n.type === 'dock_out')
  return (
    <g>
      {trace.layout.edges.map((e) => {
        const a = xy.get(e.from)
        const b = xy.get(e.to)
        if (!a || !b) return null
        return <line key={`${e.from}-${e.to}`} x1={a.y} y1={a.x} x2={b.y} y2={b.x} className={e.kind === 'main' ? 'stroke-border-strong' : 'stroke-border'} strokeWidth={e.kind === 'main' ? 0.8 : 0.4} />
      })}
      {trace.layout.chargerSlots.map(([x, y], i) => (
        <rect key={i} data-station x={y - STATION_M / 2} y={x - STATION_M / 2} width={STATION_M} height={STATION_M} transform={`rotate(45 ${String(y)} ${String(x)})`} className="fill-border-strong" />
      ))}
      {docks.map((n) => {
        const inbound = n.type === 'dock_in'
        return (
          <g key={n.id} data-gate={inbound ? 'inbound' : 'outbound'}>
            <rect x={n.y - GATE_W_M / 2} y={n.x - GATE_H_M / 2} width={GATE_W_M} height={GATE_H_M} rx={GATE_H_M / 2} className={inbound ? 'fill-inverse' : 'fill-text-secondary'} />
            <text x={n.y} y={n.x} fontSize={GATE_FONT_M} textAnchor="middle" dominantBaseline="central" className="fill-bg font-semibold">
              {inbound ? gates.inbound : gates.outbound}
            </text>
          </g>
        )
      })}
    </g>
  )
})

/** Робот доски: фигура по группе состояния. */
function BoardRobot({ x, y, state }: { readonly x: number; readonly y: number; readonly state: RobotState }) {
  const group = boardGroupOf(state)
  const look = BOARD_ROBOT_LOOK[group]
  if (look.shape === 'square') {
    return <rect data-robot={group} x={x - ROBOT_SQUARE_M / 2} y={y - ROBOT_SQUARE_M / 2} width={ROBOT_SQUARE_M} height={ROBOT_SQUARE_M} rx={ROBOT_SQUARE_RADIUS_M} className={TONE_FILL[look.tone]} />
  }
  if (look.shape === 'ring') {
    return <circle data-robot={group} cx={x} cy={y} r={ROBOT_R_M - RING_STROKE_M / 2} strokeWidth={RING_STROKE_M} className={clsx('fill-bg', TONE_STROKE[look.tone])} />
  }
  return <circle data-robot={group} cx={x} cy={y} r={ROBOT_R_M} className={TONE_FILL[look.tone]} />
}

/** Подписи зон схемы вызывающего: «Приёмка», «Отгрузка», «Зарядные станции · 6». */
export interface ZoneLabels {
  readonly inbound: string
  readonly outbound: string
  readonly chargers: string
}

interface SimPlayer2DBase {
  readonly trace: SimulationTrace
  /** Общее время плееров, с от начала записи. */
  readonly t: number
  /** Подпись плеера: «Из подбора: 18 роботов, 6 станций». */
  readonly title: string
  /** Сводка под схемой по роботам кадра `{ состояние: число }` — считает вызывающий, плеер только отдаёт кадр. */
  readonly renderStats: (byState: Readonly<Record<RobotState, number>>) => ReactNode
}

/** default — схема 07a и отчёта 09: подписи зон, роботы кружками по пяти группам. */
interface SimPlayer2DDefault extends SimPlayer2DBase {
  readonly look?: 'default'
  readonly zones: ZoneLabels
}

/** board — доска 16325 (3.5): ворота «П» / «О», станции ромбами, роботы фигурами по состоянию; легенда — `boardRobotLegend`. */
interface SimPlayer2DBoard extends SimPlayer2DBase {
  readonly look: 'board'
  readonly gates: GateLetters
}

type SimPlayer2DProps = SimPlayer2DDefault | SimPlayer2DBoard

/**
 * 2D-плеер записанного прогона (components.md: SimPlayer2D; 07a, 16198:734; D-87, D-105): SVG-схема рисуется один раз,
 * поверх — роботы кружками по состояниям в момент `t`. Плеер ничего не пересчитывает: позиции — кадры трассы,
 * между кадрами — линейная интерполяция. Время двигает `usePlaybackClock`, общий для плееров.
 */
export function SimPlayer2D(props: SimPlayer2DProps) {
  const { trace, t: time, title, renderStats } = props
  const zones = props.look === 'board' ? null : props.zones
  const frame = useMemo(() => frameOf(trace), [trace])
  const labels = useMemo(() => (zones ? [
    { key: 'inbound', text: zones.inbound, at: zoneLabelAt(frame, pointsOf(trace.layout.nodes, 'dock_in')) },
    { key: 'outbound', text: zones.outbound, at: zoneLabelAt(frame, pointsOf(trace.layout.nodes, 'dock_out')) },
    { key: 'chargers', text: zones.chargers, at: zoneLabelAt(frame, trace.layout.chargerSlots) },
  ] : []), [frame, trace, zones])
  const positions = positionsAt(trace, time)
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-10">
      <figcaption className="type-body-sm font-medium text-text">{title}</figcaption>
      <div className="flex h-(--rav-player-field-height) items-center justify-center overflow-hidden rounded-lg bg-surface-muted p-12 shadow-inset-md">
        <div className="relative h-full max-w-full" style={{ aspectRatio: `${String(frame.width)} / ${String(frame.height)}` }}>
          <svg viewBox={frame.viewBox} role="img" aria-label={title} className="absolute inset-0 size-full">
            {props.look === 'board' ? <BoardLayoutLayer trace={trace} gates={props.gates} /> : <LayoutLayer trace={trace} />}
            <g>
              {positions.map((p, i) => (props.look === 'board'
                ? <BoardRobot key={i} x={p.y} y={p.x} state={p.state} />
                : <circle key={i} data-robot={groupOf(p.state)} cx={p.y} cy={p.x} r={ROBOT_R_M} className={TONE_FILL[GROUP_TONE[groupOf(p.state)]]} />
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
