import { APP_SCREENS } from './screens/app'
import { ECONOMICS_SCREENS } from './screens/economics'
import { MATCHING_SCREENS } from './screens/matching'
import { PARAMS_SCREENS } from './screens/params'
import { PROJECTS_SCREENS } from './screens/projects'
import { SIMULATION_SCREENS } from './screens/simulation'
import type { OpenLayer, ReadyRoute, VisualScreen } from './screens/types'

export type { OpenLayer, ReadyRoute, Role, VisualScreen } from './screens/types'

/**
 * Реестр готовых экранов e2e — только сборка. Каждый раздел регистрирует свои маршруты, эталоны и слои
 * в e2e/screens/<раздел>.ts: потоки шагов проекта правят свой файл (params, matching, simulation, economics).
 */
const SECTIONS = [APP_SCREENS, PROJECTS_SCREENS, PARAMS_SCREENS, MATCHING_SCREENS, SIMULATION_SCREENS, ECONOMICS_SCREENS]

export const READY_ROUTES: readonly ReadyRoute[] = SECTIONS.flatMap((s) => s.routes)
export const VISUAL_SCREENS: readonly VisualScreen[] = SECTIONS.flatMap((s) => s.visual)
/** Слои для axe: меню, выпадающий список, модальное окно, боковая панель. */
export const A11Y_LAYERS: readonly OpenLayer[] = SECTIONS.flatMap((s) => s.layers ?? [])
