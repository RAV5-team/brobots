import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 1 «Параметры проекта». Строки — копия screens.md; правит поток этого шага. */
export const PARAMS_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-params', 'Шаг 1', 'Параметры проекта', '16197:367', '11.2', 'page', R.projectParams],
  ],
  board: [
    ['board-1.1', '1.1', 'Параметры проекта', '16969:10', '11.2', 'page', R.projectParams],
    ['board-1.1-open', '1.1', 'Параметры проекта · всё раскрыто', '16992:10', '11.2', 'state', R.projectParams],
    ['board-1.2', '1.2', 'Параметры проекта · комплектация заказов', '17009:3', '11.2', 'state', R.projectParams],
    ['board-1.3', '1.3', 'Параметры проекта · упаковка', '17009:1010', '11.2', 'state', R.projectParams],
    ['board-1.4', '1.4', 'Параметры проекта · уборка помещений', '17009:1865', '11.2', 'state', R.projectParams],
    ['board-1.5', '1.5', 'Параметры проекта · инвентаризация, подбор недоступен', '17009:2734', '11.2', 'state', R.projectParams],
  ],
}
