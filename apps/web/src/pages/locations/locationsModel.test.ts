import { describe, expect, it } from 'vitest'
import type { Location, LocationSummary } from '@/domain'
import {
  EMPTY_FILTER, buildListItems, filterLocations, isFilterActive, sortLocations, type LocationListItem,
} from './locationsModel'

const location = (id: `LOC-${string}`, name: string, city: string, facilityType: Location['facilityType'], updatedAt: string): Location => ({
  id, name, city, facilityType, updatedAt, address: '', capexBudgetRub: 0, horizonYears: 5, parameters: {}, staffGroups: [],
})

const summary = (locationId: `LOC-${string}`, over: Partial<LocationSummary> = {}): LocationSummary => ({
  locationId, totalAreaM2: null, staffTotal: null, shiftsPerDay: null, shiftHours: null, processesCount: 0,
  laborCostRubYear: null, workersInProcesses: null, parametersCompletenessPct: 100, assumptionsCount: 0,
  projectsCount: 0, projectsCompleted: 0, ...over,
})

const FACILITY_TYPES = [
  { code: 'warehouse', name: 'Склад' },
  { code: 'airport', name: 'Аэропорт' },
] as const

const ITEMS: readonly LocationListItem[] = buildListItems(
  [
    location('LOC-01', 'РЦ Химки', 'Москва', 'warehouse', '2026-09-14T09:00:00Z'),
    location('LOC-02', 'Даркстор Юг', 'Ростов-на-Дону', 'warehouse', '2026-09-09T09:00:00Z'),
    location('LOC-03', 'Терминал Внуково-2', 'Москва', 'airport', '2026-09-11T09:00:00Z'),
  ],
  [
    summary('LOC-01', { parametersCompletenessPct: 78, assumptionsCount: 2, projectsCount: 2, laborCostRubYear: 231e6 }),
    summary('LOC-02', { projectsCount: 1, projectsCompleted: 1, laborCostRubYear: 84e6 }),
    summary('LOC-03', { parametersCompletenessPct: 97, laborCostRubYear: 183e6 }),
  ],
  FACILITY_TYPES,
)

const names = (items: readonly LocationListItem[]) => items.map((i) => i.location.name)

describe('locations list model (экран 12)', () => {
  it('joins a location with its summary and facility type name', () => {
    expect(ITEMS.map((i) => [i.location.id, i.facilityTypeName])).toEqual([
      ['LOC-01', 'Склад'], ['LOC-02', 'Склад'], ['LOC-03', 'Аэропорт'],
    ])
  })

  it('skips a location without a summary', () => {
    expect(buildListItems([location('LOC-09', 'X', 'Y', 'warehouse', '2026-01-01T00:00:00Z')], [], FACILITY_TYPES)).toEqual([])
  })

  it('searches by name, city and facility type ignoring case and «ё» (PRD 10.1)', () => {
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, query: 'химки' }))).toEqual(['РЦ Химки'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, query: 'ростов' }))).toEqual(['Даркстор Юг'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, query: 'АЭРОПОРТ' }))).toEqual(['Терминал Внуково-2'])
  })

  it('filters by facility type, profile completeness and projects like the API', () => {
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, facilityType: 'airport' }))).toEqual(['Терминал Внуково-2'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, completeness: 'complete' }))).toEqual(['Даркстор Юг'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, completeness: 'has_missing' }))).toEqual(['РЦ Химки', 'Терминал Внуково-2'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, completeness: 'has_assumptions' }))).toEqual(['РЦ Химки'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, projects: 'has_completed' }))).toEqual(['Даркстор Юг'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, projects: 'drafts' }))).toEqual(['РЦ Химки'])
    expect(names(filterLocations(ITEMS, { ...EMPTY_FILTER, projects: 'none' }))).toEqual(['Терминал Внуково-2'])
  })

  it('sorts recently updated first by default and by other keys without mutating the input', () => {
    const before = names(ITEMS)
    expect(names(sortLocations(ITEMS, 'updated'))).toEqual(['РЦ Химки', 'Терминал Внуково-2', 'Даркстор Юг'])
    expect(names(sortLocations(ITEMS, 'name'))).toEqual(['Даркстор Юг', 'РЦ Химки', 'Терминал Внуково-2'])
    expect(names(sortLocations(ITEMS, 'completeness'))).toEqual(['Даркстор Юг', 'Терминал Внуково-2', 'РЦ Химки'])
    expect(names(sortLocations(ITEMS, 'projects'))).toEqual(['РЦ Химки', 'Даркстор Юг', 'Терминал Внуково-2'])
    expect(names(sortLocations(ITEMS, 'labor_cost'))).toEqual(['РЦ Химки', 'Терминал Внуково-2', 'Даркстор Юг'])
    expect(names(ITEMS)).toEqual(before)
  })

  it('treats only a query or a chosen option as an active filter', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTER, query: '  ' })).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTER, projects: 'none' })).toBe(true)
  })
})
