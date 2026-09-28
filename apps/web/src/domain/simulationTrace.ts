/**
 * Записанный прогон для 2D-плеера (07a, PRD 11.4): схема склада и кадры с позициями и состояниями роботов.
 * Формат сервиса — simcore.viz.export_trace (в openapi.json схемы нет, см. docs/api-contract.md, №6).
 * Плеер ничего не пересчитывает — только воспроизводит кадры.
 */

/** Состояние робота в кадре — из перечня трассы (`idle`, `to_drop`, `blocked`…). */
export type RobotState = string

export interface TraceNode {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly type: 'junction' | 'storage' | 'dock_in' | 'dock_out' | 'charger'
}

export interface TraceEdge {
  readonly from: string
  readonly to: string
  readonly kind: string
}

export interface TraceLayout {
  readonly nodes: readonly TraceNode[]
  readonly edges: readonly TraceEdge[]
  readonly chargerSlots: readonly (readonly [number, number])[]
  /** Габариты схемы, м. */
  readonly width: number
  readonly depth: number
}

/** Кадр: время от начала записи, с; по роботу — x, y (м) и индекс состояния в `states`. */
export interface TraceFrame {
  readonly t: number
  readonly robots: readonly (readonly [number, number, number])[]
}

export interface SimulationTrace {
  /** Подпись плеера: «Из подбора: 18/6». */
  readonly name: string
  readonly stepS: number
  readonly robots: number
  readonly chargers: number
  /** Час на часах объекта, с которого начинается запись. */
  readonly clockOffsetH: number
  readonly states: readonly RobotState[]
  readonly layout: TraceLayout
  readonly frames: readonly TraceFrame[]
}

export interface RobotPosition {
  readonly x: number
  readonly y: number
  readonly state: RobotState
}

export const traceDuration = (trace: SimulationTrace): number => trace.frames.at(-1)?.t ?? 0

/** Позиции в момент t, с: между кадрами — линейно, состояние — из предыдущего кадра. Кадры идут с шагом `stepS`. */
export function positionsAt(trace: SimulationTrace, t: number): readonly RobotPosition[] {
  const { frames, stepS, states } = trace
  const last = frames.length - 1
  const exact = Math.min(Math.max(t / stepS, 0), last)
  const i = Math.min(Math.floor(exact), Math.max(last - 1, 0))
  const f = last === 0 ? 0 : exact - i
  const a = frames[i]
  const b = frames[Math.min(i + 1, last)]
  if (!a || !b) return []
  return a.robots.map(([x0, y0, s0], r) => {
    const [x1, y1, s1] = b.robots[r] ?? [x0, y0, s0]
    // На самом последнем кадре состояние — его собственное.
    const state = f >= 1 ? s1 : s0
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, state: states[state] ?? 'idle' }
  })
}

/** Роботы по состояниям — сводка под плеером («Роботов в работе», «Свободны»). */
export function countStates(positions: readonly RobotPosition[]): Readonly<Record<RobotState, number>> {
  return positions.reduce<Record<RobotState, number>>((acc, p) => ({ ...acc, [p.state]: (acc[p.state] ?? 0) + 1 }), {})
}
