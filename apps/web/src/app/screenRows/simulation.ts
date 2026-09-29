import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 3 «Симуляция». Строки — копия screens.md; правит поток этого шага. */
export const SIMULATION_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-simulation', 'Шаг 3', 'Симуляция', '16197:1114', '11.4', 'page', R.projectSimulation],
    ['proto-05', '05', 'Симуляция · условия', '16197:1285', '11.4', 'state', R.projectSimulation],
    ['proto-06', '06', 'Симуляция · прогон', '16197:1700', '11.4', 'state', R.projectSimulation],
    ['proto-07-confirmed', '07', 'Симуляция · вердикт · подтверждено (демо-проект)', '16197:1815', '11.4', 'state', R.projectSimulation],
    ['proto-07-can-reduce', '07', 'Симуляция · вердикт · можно уменьшить (демо-проект)', '16197:1815', '11.4', 'state', R.projectSimulation],
    ['proto-07-need-more', '07b', 'Симуляция · вердикт · нужно докупить (демо-проект)', '16198:895', '11.4', 'state', R.projectSimulation],
    ['proto-07-layout', '07', 'Симуляция · вердикт · узкое место планировки (демо-проект)', '16197:1815', '11.4', 'state', R.projectSimulation],
    ['proto-07-unreachable', '07', 'Симуляция · вердикт · поток недостижим (демо-проект)', '16197:1815', '11.4', 'state', R.projectSimulation],
    ['proto-07a', '07a', 'Симуляция · графики и 2D-сравнение · можно уменьшить (демо-проект)', '16198:29', '11.4', 'state', R.projectSimulation],
    ['proto-07c', '07c', 'Вердикт · свой состав', '16198:903', '11.4', 'state', R.projectSimulation],
  ],
  board: [
    ['board-3.1', '3.1', 'Что проверяем', '16325:149', '11.4', 'state', R.projectSimulation],
    ['board-3.2', '3.2', 'Условия симуляции', '16325:158', '11.4', 'state', R.projectSimulation],
    ['board-3.3', '3.3', 'Прогон', '16325:167', '11.4', 'state', R.projectSimulation],
    ['board-3.4', '3.4', 'Вердикт · нужно докупить', '16325:176', '11.4', 'state', R.projectSimulation],
    ['board-3.5', '3.5', 'Графики и 2D-сравнение', '16325:185', '11.4', 'state', R.projectSimulation],
    ['board-3.6', '3.6', 'Вердикт · состав подтверждён', '16325:194', '11.4', 'state', R.projectSimulation],
  ],
}
