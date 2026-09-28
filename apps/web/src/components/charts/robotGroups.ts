import type { RobotState } from '@/domain'
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
