import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { NEW_LOCATION_SAMPLE } from '@/mocks/fixtures/newLocation'
import type { Services } from '@/services'
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
}
