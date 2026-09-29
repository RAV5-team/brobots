import { projectStepPath } from '@/app/routePaths'
import { matchingViewState } from '@/pages/projects/steps/matching/matchingView'
import type { ScreenScenario } from './types'

const MATCHING = projectStepPath('PJ-DEMO', 'matching')

/** 2.1 · всё раскрыто (17093:10): разбор балла у всех 8 строк; условия, исключённые и сравнение открыты и так. */
const matchingExpanded: ScreenScenario = () => Promise.resolve({ to: MATCHING, state: matchingViewState({ expandAll: true }) })

/** 2.1 · режим «Сравнить» (16834:5): отмечены два первых варианта, как на макете. */
const matchingCompare: ScreenScenario = () =>
  Promise.resolve({ to: MATCHING, state: matchingViewState({ compare: ['RB-0008:raas', 'RB-0001:raas'] }) })

/** 2.1 · строка в конце рейтинга (16834:69): Ronavi SD добавлен вручную — вне рейтинга, критическое несоответствие. */
const matchingManual: ScreenScenario = async (services) => {
  await services.projects.updateInputs('PJ-DEMO', { matching: { manualSolutionIds: ['RB-0004'] } })
  return { to: MATCHING, state: null }
}

/** Шаг 2 «Подбор решений»: состояния экрана 2.1, до которых не дойти по ссылке. */
export const MATCHING_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  'board-2.1-expanded': matchingExpanded,
  'board-2.1-compare': matchingCompare,
  'board-2.1-manual': matchingManual,
}
