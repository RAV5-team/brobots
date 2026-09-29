import { ROUTE_PATHS as R } from '../routePaths'
import type { StepScreenRows } from './types'

/** Список проектов и окно «Новый проект» (A1, A2; 00, 01, 01a). Строки — копия screens.md; правит поток этого шага. */
export const PROJECTS_SCREENS: StepScreenRows = {
  prototype: [
    ['pending-projects', '00', 'Проекты · список', '16197:4', '11.1', 'page', R.projects],
    ['pending-project-new', '01', 'Новый проект · выбор локации', '16197:228', '11.1', 'modal', R.projects],
    ['proto-01a', '01a', 'Новый проект · создать локацию (D-85 open)', '16202:2', '11.1', 'modal', R.projects],
  ],
  board: [
    ['board-A1', 'A1', 'Проекты', '16325:14', '11.1', 'page', R.projects],
    ['board-A2', 'A2', 'Новый проект · мои локации', '16325:23', '11.1', 'modal', R.projects],
  ],
}
