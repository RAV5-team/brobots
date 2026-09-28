import { projectStepPath } from '@/app/routePaths'
import type { ScreenScenario } from './types'

/** 08a: выбран сценарий «покупка» — как после «Выбрать этот сценарий»; переключатель в шапке тоже на покупке. */
const economicsPurchase: ScreenScenario = async (services) => {
  await services.projects.updateInputs('PJ-DEMO', { economics: { scenario: 'purchase' } })
  return { to: `${projectStepPath('PJ-DEMO', 'economics')}?scenario=purchase`, state: null }
}

/** 08b: КП по выбранному решению запрошено (D-106) — подвал показывает «КП запрошено · дата». */
const economicsQuoteRequested: ScreenScenario = async (services) => {
  await services.projects.requestQuote('PJ-DEMO')
  return { to: projectStepPath('PJ-DEMO', 'economics'), state: null }
}

/** Шаг 4: состояния итога, до которых не дойти по ссылке. */
export const ECONOMICS_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  'proto-08a': economicsPurchase,
  'proto-08b': economicsQuoteRequested,
}
