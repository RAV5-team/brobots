import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 4 «Итог и экономика» и отчёт PDF. Строки — копия screens.md; правит поток этого шага. */
export const ECONOMICS_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-economics', 'Шаг 4', 'Итог и экономика', '16197:2005', '11.5', 'page', R.projectEconomics],
    ['proto-08a', '08a', 'Итог · выбран сценарий «покупка» (демо-проект)', '16198:911', '11.5', 'state', R.projectEconomics],
    ['proto-08b', '08b', 'Итог · КП запрошено (демо-проект)', '16198:919', '11.6', 'state', R.projectEconomics],
    ['pending-report', '—', 'Отчёт PDF', '16197:2318', '11.6', 'page', R.projectReport],
  ],
  board: [
    ['board-4.1', '4.1', 'Итог и экономика · RaaS', '16325:206', '11.5', 'page', R.projectEconomics],
    ['board-4.2', '4.2', 'Итог · покупка', '16325:215', '11.5', 'state', R.projectEconomics],
    ['board-4.3', '4.3', 'Проект сохранён', '16325:224', '11.5, 11.6', 'state', R.projectEconomics],
    ['board-4.4', '4.4', 'Итог · демо-режим', '16325:233', '11.5, 11.6', 'state', R.projectEconomics],
    ['board-4.5', '4.5', 'Отчёт PDF', '16325:242', '11.6', 'page', R.projectReport],
  ],
}
