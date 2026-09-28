import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { NEW_LOCATION_SAMPLE } from '@/mocks/fixtures/newLocation'
import type { Services } from '@/services'
import type { SimulationVerdict } from '@/domain'
import { projectStepPath } from '@/app/routePaths'
import { createdLocationState } from '@/pages/locations/createdLocation'
import { buildInitialForm, indexParameters, locationNewState } from '@/pages/locations/new/locationForm'
import { LOCATION_DEMO_PROFILE, mockupForm } from '@/pages/locations/new/locationNew.mock'

/** Куда перейти и с каким состоянием навигации, чтобы открыть экран-состояние. */
export interface ScenarioTarget {
  readonly to: string
  readonly state: unknown
}

export type ScreenScenario = (services: Services) => Promise<ScenarioTarget>

/** 12а: сохранить локацию, как форма 14, и вернуться в список. */
async function createdLocation(services: Services): Promise<ScenarioTarget> {
  const created = await services.locations.createLocation(NEW_LOCATION_SAMPLE)
  return { to: ROUTE_PATHS.locations, state: createdLocationState(created.id) }
}

/** locprocsempty: у только что сохранённой локации процессов нет — вкладка «Процессы локации» пуста. */
async function locationWithoutProcesses(services: Services): Promise<ScenarioTarget> {
  const created = await services.locations.createLocation(NEW_LOCATION_SAMPLE)
  return { to: generatePath(ROUTE_PATHS.locationProcesses, { locationId: created.id }), state: null }
}

/** 14: форма ровно как на макете — активная зона больше общей (ошибка), оклад упаковщиков пуст. Для сверки с Figma. */
async function locationFormMockup(services: Services): Promise<ScenarioTarget> {
  const params = indexParameters(await services.locations.listFacilityParameters('warehouse'))
  return { to: ROUTE_PATHS.locationNew, state: locationNewState(mockupForm(buildInitialForm(params, LOCATION_DEMO_PROFILE))) }
}

/** Прогоны демо-проекта по вердиктам — синтетические фикстуры simulationRuns.generated.ts. */
const RUN_BY_VERDICT: Readonly<Record<SimulationVerdict, string>> = {
  confirmed: 'SIM-0926-01',
  can_reduce: 'SIM-0926-02',
  need_more: 'SIM-0926-03',
  layout_bottleneck: 'SIM-0926-04',
  unreachable: 'SIM-0926-05',
}

/** 07: демо-проект с прогоном нужного вердикта — состав как у проверенного в прогоне, этап «Вердикт». */
/** Демо-проект с прогоном нужного вердикта; `charts` — сразу вкладка «Графики и 2D-сравнение» (07a). */
const simulationVerdict = (verdict: SimulationVerdict, tab: 'verdict' | 'charts' = 'verdict'): ScreenScenario => async (services) => {
  const run = await services.projects.getSimulationRun(RUN_BY_VERDICT[verdict])
  await services.projects.updateInputs('PJ-DEMO', { simulation: { stage: 'verdict', fleet: run.from, plan: run.to, runId: run.id, acceptRisk: false } })
  const path = projectStepPath('PJ-DEMO', 'simulation')
  return { to: tab === 'charts' ? `${path}?stage=verdict&tab=charts` : path, state: null }
}

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

/**
 * Экраны-состояния, до которых нельзя дойти по ссылке, пока нет предыдущего шага (id — из app/screens).
 * 12а открывается после формы 14; сценарий делает то же, что она: сохраняет локацию и возвращает в список.
 * Пустая вкладка процессов — у новой локации: сценарий сохраняет её и открывает `/processes`.
 * 14 открывается в состоянии макета (с ошибкой площади); обычная форма — по «Добавить локацию» на 12.
 */
export const SCREEN_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  '12а': createdLocation,
  '14': locationFormMockup,
  'first-locprocsempty': locationWithoutProcesses,
  'proto-07-confirmed': simulationVerdict('confirmed'),
  'proto-07-can-reduce': simulationVerdict('can_reduce'),
  'proto-07-need-more': simulationVerdict('need_more'),
  'proto-07-layout': simulationVerdict('layout_bottleneck'),
  'proto-07-unreachable': simulationVerdict('unreachable'),
  'proto-07a': simulationVerdict('can_reduce', 'charts'),
  'proto-08a': economicsPurchase,
  'proto-08b': economicsQuoteRequested,
}
