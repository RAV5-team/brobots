import { projectStepPath } from '@/app/routePaths'
import type { LocationProcessId } from '@/domain'
import { paramsExpandedState } from '@/pages/projects/steps/params/useGroupReveal'
import type { ScreenScenario } from './types'

/** 1.1 «всё раскрыто» (16992:10): группы процесса и локации, разбор нагрузки и все параметры локации открыты; поповер закрыт. */
const paramsExpanded: ScreenScenario = () => Promise.resolve({ to: projectStepPath('PJ-DEMO', 'params'), state: paramsExpandedState() })

/**
 * Варианты 1.2–1.3 (17009:*): у демо-проекта выбран другой процесс локации, как радиокнопкой на шаге 1 (D-94);
 * группы раскрыты, локация — только применимые параметры, разбор нагрузки — как на фрагменте.
 */
const processVariant = (processId: LocationProcessId, breakdown: boolean): ScreenScenario => async (services) => {
  await services.projects.selectProcess('PJ-DEMO', processId)
  return { to: projectStepPath('PJ-DEMO', 'params'), state: paramsExpandedState({ siteAll: false, breakdown }) }
}

/** 1.5 (17009:2734…): проект PJ-07 уже на инвентаризации без частоты пересчёта — подбор недоступен; группы раскрыты. */
const inventoryBlocked: ScreenScenario = () =>
  Promise.resolve({ to: projectStepPath('PJ-07', 'params'), state: paramsExpandedState({ siteAll: false, breakdown: false }) })

/** Шаг 1 «Параметры проекта»: экраны-состояния /dev/screens этого шага. */
export const PARAMS_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  'board-1.1-open': paramsExpanded,
  // Комплектация: мезонин и лифт по доске — в фикстуре LP-02 их нет, данные текущие (ждёт D-110).
  'board-1.2': processVariant('LP-02', true),
  // Упаковка: свой график 16 ч, оклад не указан — экономия труда не рассчитается (PRD 11.2).
  'board-1.3': processVariant('LP-03', false),
  // Уборка: работа по площади, исполнители не привязаны — экономия труда не рассчитается (PRD 11.2).
  // Маршрут в данных применяется, свой график 8 ч, кратности уборки нет (ждёт D-93, D-91).
  'board-1.4': processVariant('LP-04', false),
  // Инвентаризация: кладовщиков в данных нет (ждёт D-91).
  'board-1.5': inventoryBlocked,
}
