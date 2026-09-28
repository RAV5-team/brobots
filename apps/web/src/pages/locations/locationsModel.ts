import type { FacilityType, FacilityTypeCode, Location, LocationSummary } from '@/domain'

/** Карточка списка: локация, её сводка и название типа объекта. */
export interface LocationListItem {
  readonly location: Location
  readonly summary: LocationSummary
  readonly facilityTypeName: string
}

/** Значения фильтров и сортировки — как параметры `GET /locations` в services/api. */
export type CompletenessFilter = 'complete' | 'has_assumptions' | 'has_missing'
export type ProjectsFilter = 'has_completed' | 'drafts' | 'none'
export type LocationSort = 'updated' | 'name' | 'completeness' | 'projects' | 'labor_cost'

export const COMPLETENESS_FILTERS: readonly CompletenessFilter[] = ['complete', 'has_assumptions', 'has_missing']
export const PROJECTS_FILTERS: readonly ProjectsFilter[] = ['has_completed', 'drafts', 'none']
export const LOCATION_SORTS: readonly LocationSort[] = ['updated', 'name', 'completeness', 'projects', 'labor_cost']

export interface LocationFilter {
  readonly query: string
  readonly facilityType: FacilityTypeCode | null
  readonly completeness: CompletenessFilter | null
  readonly projects: ProjectsFilter | null
}

export const EMPTY_FILTER: LocationFilter = { query: '', facilityType: null, completeness: null, projects: null }
export const DEFAULT_SORT: LocationSort = 'updated'

const FULL_PROFILE_PCT = 100

/** Собирает карточки; локация без сводки не показывается — её нечем заполнить. */
export function buildListItems(
  locations: readonly Location[],
  summaries: readonly LocationSummary[],
  facilityTypes: readonly FacilityType[],
): readonly LocationListItem[] {
  return locations.flatMap((location) => {
    const summary = summaries.find((s) => s.locationId === location.id)
    if (!summary) return []
    const facilityTypeName = facilityTypes.find((f) => f.code === location.facilityType)?.name ?? location.facilityType
    return [{ location, summary, facilityTypeName }]
  })
}

/** Поиск без учёта регистра и различия «е» / «ё». */
function normalize(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()
}

const COMPLETENESS_MATCH: Record<CompletenessFilter, (s: LocationSummary) => boolean> = {
  complete: (s) => s.parametersCompletenessPct >= FULL_PROFILE_PCT,
  has_assumptions: (s) => s.assumptionsCount > 0,
  has_missing: (s) => s.parametersCompletenessPct < FULL_PROFILE_PCT,
}

const PROJECTS_MATCH: Record<ProjectsFilter, (s: LocationSummary) => boolean> = {
  has_completed: (s) => s.projectsCompleted > 0,
  drafts: (s) => s.projectsCount > 0 && s.projectsCompleted === 0,
  none: (s) => s.projectsCount === 0,
}

/** Поиск — по названию, городу и типу объекта (PRD 10.1); фильтры — как в API. */
export function filterLocations(items: readonly LocationListItem[], filter: LocationFilter): readonly LocationListItem[] {
  const query = normalize(filter.query)
  return items.filter(({ location, summary, facilityTypeName }) =>
    (filter.facilityType === null || location.facilityType === filter.facilityType) &&
    (filter.completeness === null || COMPLETENESS_MATCH[filter.completeness](summary)) &&
    (filter.projects === null || PROJECTS_MATCH[filter.projects](summary)) &&
    (query === '' || normalize(`${location.name} ${location.city} ${facilityTypeName}`).includes(query)),
  )
}

type Compare = (a: LocationListItem, b: LocationListItem) => number

const COMPARE: Record<LocationSort, Compare> = {
  updated: (a, b) => Date.parse(b.location.updatedAt) - Date.parse(a.location.updatedAt),
  name: (a, b) => a.location.name.localeCompare(b.location.name, 'ru-RU'),
  completeness: (a, b) => b.summary.parametersCompletenessPct - a.summary.parametersCompletenessPct,
  projects: (a, b) => b.summary.projectsCount - a.summary.projectsCount,
  labor_cost: (a, b) => (b.summary.laborCostRubYear ?? 0) - (a.summary.laborCostRubYear ?? 0),
}

/** Новый массив в заданном порядке; равные остаются в исходном порядке. */
export function sortLocations(items: readonly LocationListItem[], sort: LocationSort): readonly LocationListItem[] {
  return [...items].sort(COMPARE[sort])
}

export function isFilterActive(filter: LocationFilter): boolean {
  return filter.query.trim() !== '' || filter.facilityType !== null || filter.completeness !== null || filter.projects !== null
}
