import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 1 «Параметры проекта». Строки — копия screens.md; правит поток этого шага. */
export const PARAMS_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-params', 'Шаг 1', 'Параметры проекта', '16197:367', '11.2', 'page', R.projectParams],
  ],
  board: [
    ['board-1.1', '1.1', 'Параметры проекта', '16325:53', '11.2', 'page', R.projectParams],
  ],
}
