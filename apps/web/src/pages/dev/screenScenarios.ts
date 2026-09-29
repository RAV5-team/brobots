import { ECONOMICS_SCENARIOS } from './scenarios/economics'
import { LOCATION_SCENARIOS } from './scenarios/locations'
import { MATCHING_SCENARIOS } from './scenarios/matching'
import { PARAMS_SCENARIOS } from './scenarios/params'
import { SIMULATION_SCENARIOS } from './scenarios/simulation'
import type { ScreenScenario } from './scenarios/types'

export type { ScenarioTarget, ScreenScenario } from './scenarios/types'

/**
 * Экраны-состояния, до которых нельзя дойти по ссылке, пока нет предыдущего шага (id — из app/screens).
 * Сценарии — по файлу на раздел (pages/dev/scenarios): поток шага правит только свой файл, здесь — только сборка.
 */
export const SCREEN_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  ...LOCATION_SCENARIOS,
  ...PARAMS_SCENARIOS,
  ...MATCHING_SCENARIOS,
  ...SIMULATION_SCENARIOS,
  ...ECONOMICS_SCENARIOS,
}
