import type { RobotState } from '@/domain'
import type { LegendItem } from './ChartLegend'
import type { ChartSeries, ChartTone } from './chartTones'

/** Группы состояний робота на схеме и в легенде — тона графиков (D-87), не цвета сервиса `state_colors`. */
export type RobotGroup = 'work' | 'waiting' | 'charging' | 'down' | 'idle'

const GROUP_OF: Readonly<Record<RobotState, RobotGroup>> = {
  to_pickup: 'work', loading: 'work', to_drop: 'work', unloading: 'work',
  blocked: 'waiting', queue: 'waiting', wait_charger: 'waiting',
  to_charger: 'charging', charging: 'charging',
  down: 'down', towed: 'down',
  idle: 'idle',
}
export const GROUP_TONE: Readonly<Record<RobotGroup, ChartTone>> = {
  work: 'strong', waiting: 'danger', charging: 'accent', down: 'danger-soft', idle: 'secondary',
}
const ROBOT_GROUPS = Object.keys(GROUP_TONE) as RobotGroup[]

/** Легенда плеера: серии групп с подписями вызывающего. */
export const robotLegend = (labels: Readonly<Record<RobotGroup, string>>): readonly ChartSeries[] =>
  ROBOT_GROUPS.map((g) => ({ key: g, label: labels[g], tone: GROUP_TONE[g] }))

/** Группа состояния трассы; неизвестное состояние — «свободен». */
export const groupOf = (state: RobotState): RobotGroup => GROUP_OF[state] ?? 'idle'

/**
 * Группы состояний на схеме доски 16325 (3.5, 17040:10): «едет за паллетой» отдельно от «с паллетой».
 * В легенде доски пять знаков (свободен, едет, с паллетой, станция, в очереди); зарядка, ремонт и ожидание проезда
 * нарисованы, но в легенду не вынесены (proposed).
 */
export type BoardRobotGroup = 'idle' | 'toPickup' | 'loaded' | 'queue' | 'blocked' | 'charging' | 'down'

const BOARD_GROUP_OF: Readonly<Record<RobotState, BoardRobotGroup>> = {
  idle: 'idle',
  to_pickup: 'toPickup',
  loading: 'loaded', to_drop: 'loaded', unloading: 'loaded',
  wait_charger: 'queue',
  blocked: 'blocked', queue: 'blocked',
  to_charger: 'charging', charging: 'charging',
  down: 'down', towed: 'down',
}

/** Фигура робота: ring — пустой круг обводкой, dot — круг, square — квадрат. */
export type RobotShape = 'ring' | 'dot' | 'square'

/** Фигура и тон робота по группе доски: свободен — серый круг-обводка, едет — чёрная обводка, с паллетой — чёрный квадрат, в очереди — красная точка. */
export const BOARD_ROBOT_LOOK: Readonly<Record<BoardRobotGroup, { readonly shape: RobotShape; readonly tone: ChartTone }>> = {
  idle: { shape: 'ring', tone: 'secondary' },
  toPickup: { shape: 'ring', tone: 'strong' },
  loaded: { shape: 'square', tone: 'strong' },
  queue: { shape: 'dot', tone: 'danger' },
  blocked: { shape: 'ring', tone: 'danger' },
  charging: { shape: 'dot', tone: 'light' },
  down: { shape: 'dot', tone: 'accent' },
}

/** Группа доски для состояния трассы; неизвестное — «свободен». */
export const boardGroupOf = (state: RobotState): BoardRobotGroup => BOARD_GROUP_OF[state] ?? 'idle'

/** Подписи легенды доски — от экрана. */
export interface BoardLegendLabels {
  readonly idle: string
  readonly toPickup: string
  readonly loaded: string
  readonly station: string
  readonly queue: string
}

/** Легенда над схемами 3.5: пять знаков по форме — для `ChartLegend` (у пунктов свой `marker`). */
export const boardRobotLegend = (labels: BoardLegendLabels): readonly LegendItem[] => [
  { key: 'idle', label: labels.idle, tone: BOARD_ROBOT_LOOK.idle.tone, marker: 'ring' },
  { key: 'toPickup', label: labels.toPickup, tone: BOARD_ROBOT_LOOK.toPickup.tone, marker: 'ring' },
  { key: 'loaded', label: labels.loaded, tone: BOARD_ROBOT_LOOK.loaded.tone, marker: 'square' },
  { key: 'station', label: labels.station, tone: 'light', marker: 'diamond' },
  { key: 'queue', label: labels.queue, tone: BOARD_ROBOT_LOOK.queue.tone, marker: 'dot' },
]
