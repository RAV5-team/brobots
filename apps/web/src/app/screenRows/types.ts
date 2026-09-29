import type { RoutePath } from '../routePaths'

/** Как экран живёт на маршруте: отдельная страница, состояние страницы или модальное окно. */
export type ScreenKind = 'page' | 'state' | 'modal'

export type ScreenRow = [
  id: string,
  code: string,
  title: string,
  nodeId: string | null,
  prd: string,
  kind: ScreenKind,
  route: RoutePath | null,
]

/** Строки шага проекта в двух сериях реестра: прототип 15877:2 и доска 16325:2. */
export interface StepScreenRows {
  readonly prototype: readonly ScreenRow[]
  readonly board: readonly ScreenRow[]
}
