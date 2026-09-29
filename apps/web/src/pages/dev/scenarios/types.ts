import type { Services } from '@/services'

/** Куда перейти и с каким состоянием навигации, чтобы открыть экран-состояние. */
export interface ScenarioTarget {
  readonly to: string
  readonly state: unknown
}

export type ScreenScenario = (services: Services) => Promise<ScenarioTarget>
