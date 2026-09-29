import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 2 «Подбор решения». Строки — копия screens.md; правит поток этого шага. */
export const MATCHING_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-matching', 'Шаг 2', 'Подбор решения', '16197:713', '11.3', 'page', R.projectMatching],
    ['proto-03a', '03a', 'Подбор · как рассчитано', '16202:92', '11.3', 'modal', R.projectMatching],
    ['proto-03b', '03b', 'Подбор · веса критериев — не делаем (D-88)', '16202:581', '11.3', 'modal', null],
  ],
  board: [
    ['board-2.1', '2.1', 'Подбор решения', '16325:101', '11.3', 'page', R.projectMatching],
    ['board-2.2', '2.2', 'Как посчитан подбор', '16325:110', '11.3', 'modal', R.projectMatching],
  ],
}
