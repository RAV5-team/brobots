import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Шаг 2 «Подбор решений». Строки — копия screens.md; правит поток этого шага. */
export const MATCHING_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-matching', 'Шаг 2', 'Подбор решения', '16197:713', '11.3', 'page', R.projectMatching],
    ['proto-03b', '03b', 'Подбор · веса критериев — не делаем (D-88)', '16202:581', '11.3', 'modal', null],
  ],
  board: [
    ['board-2.1', '2.1', 'Подбор решений', '16325:101', '11.3', 'page', R.projectMatching],
    ['board-2.1-expanded', '2.1', 'Подбор решений · всё раскрыто (демо-проект)', '17093:10', '11.3', 'state', R.projectMatching],
    ['board-2.1-compare', '2.1', 'Подбор решений · режим «Сравнить» (демо-проект)', '16834:5', '11.3', 'state', R.projectMatching],
    ['board-2.1-manual', '2.1', 'Подбор решений · добавлено вручную, вне рейтинга (демо-проект)', '16834:69', '11.3', 'state', R.projectMatching],
    ['board-2.1а', '2.1а', 'Подробнее о решении · Обзор', '16666:10', '11.3', 'modal', R.projectMatching],
    ['board-2.1а2', '2.1а2', 'Подробнее о решении · Технические', '16830:10', '11.3', 'modal', R.projectMatching],
    ['board-2.1а3', '2.1а3', 'Подробнее о решении · Инфраструктура', '16832:10', '11.3', 'modal', R.projectMatching],
    ['board-2.1а4', '2.1а4', 'Подробнее о решении · Экономика', '16832:677', '11.3', 'modal', R.projectMatching],
    ['board-2.1а5', '2.1а5', 'Подробнее о решении · Качество данных', '16832:1463', '11.3', 'modal', R.projectMatching],
    ['board-2.1а6', '2.1а6', 'Подробнее о решении · невыбранный вариант (Покупка)', '17103:735', '11.3', 'modal', R.projectMatching],
    ['board-2.1б', '2.1б', 'Сравнение вариантов', '16833:10', '11.3', 'modal', R.projectMatching],
  ],
}
