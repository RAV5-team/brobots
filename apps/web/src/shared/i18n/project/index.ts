import { common } from './common'
import { economics } from './economics'
import { matching } from './matching'
import { params } from './params'
import { simulation } from './simulation'

/**
 * Шаги проекта-оценки (PRD 11; доска 16325:2, секция 15877:2). Часть словаря `ru` — вынесена, чтобы ru.ts не рос.
 * Файл на шаг: у каждого потока свой словарь (params, matching, simulation, economics), общее — common.
 * Короткие стадии и заголовки шагов — `ru.projectStages`, `ru.projectStepTitles`.
 */
export const project = {
  ...common,
  params,
  matching,
  economics,
  simulation,
} as const
