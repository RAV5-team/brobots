import type { LocationId } from '@/domain'

/**
 * Состояние навигации, с которым форма 14 возвращает в список после сохранения (экран 12а, D-35):
 * `navigate(ROUTE_PATHS.locations, { state: createdLocationState(id) })`. В URL не пишется — ссылка на список
 * не должна снова объявлять локацию созданной.
 */
export interface CreatedLocationState {
  readonly createdLocationId: LocationId
}

export function createdLocationState(createdLocationId: LocationId): CreatedLocationState {
  return { createdLocationId }
}

/** id созданной локации из `location.state`; всё остальное (чужое состояние, пустое) — null. */
export function readCreatedLocationId(state: unknown): LocationId | null {
  if (typeof state !== 'object' || state === null || !('createdLocationId' in state)) return null
  const { createdLocationId } = state
  return typeof createdLocationId === 'string' && createdLocationId.trim() !== '' ? createdLocationId : null
}
