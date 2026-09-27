import { describe, expect, it } from 'vitest'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROJECTS } from '@/mocks/fixtures/projects'
import {
  EMPTY_FILTER,
  buildRows,
  countByTab,
  filterRows,
  isFilterActive,
  parseProjectsSearch,
  stageLabel,
  toProjectsSearch,
} from './projectsModel'

const rows = buildRows(PROJECTS, LOCATIONS)
const ids = (list: ReturnType<typeof filterRows>) => list.map((r) => r.project.id)

describe('countByTab', () => {
  it('counts all, drafts and saved assessments over the whole list (PRD 11.1)', () => {
    expect(countByTab(PROJECTS)).toEqual({ all: 7, draft: 3, saved: 4 })
  })

  it('counts zeros for an empty list', () => {
    expect(countByTab([])).toEqual({ all: 0, draft: 0, saved: 0 })
  })
})

describe('buildRows', () => {
  it('adds the location name in service order', () => {
    expect(rows.map((r) => [r.project.id, r.locationName])[3]).toEqual(['PJ-04', 'Терминал Внуково-2'])
  })
})

describe('filterRows', () => {
  it('shows every project on «Все»', () => {
    expect(filterRows(rows, EMPTY_FILTER)).toHaveLength(7)
  })

  it('splits drafts and saved assessments', () => {
    expect(ids(filterRows(rows, { tab: 'draft', query: '' }))).toEqual(['PJ-02', 'PJ-04', 'PJ-07'])
    expect(ids(filterRows(rows, { tab: 'saved', query: '' }))).toEqual(['PJ-01', 'PJ-03', 'PJ-05', 'PJ-06'])
  })

  it('searches by location, ignoring case', () => {
    expect(ids(filterRows(rows, { tab: 'all', query: 'внуково' }))).toEqual(['PJ-04'])
  })

  it('searches by project name and combines with the tab', () => {
    expect(ids(filterRows(rows, { tab: 'all', query: 'паллет' }))).toEqual(['PJ-01', 'PJ-06'])
    expect(ids(filterRows(rows, { tab: 'draft', query: 'химки' }))).toEqual(['PJ-02', 'PJ-07'])
  })

  it('treats «ё» as «е» and trims the query', () => {
    expect(ids(filterRows(rows, { tab: 'all', query: '  ГКБ ' }))).toEqual(['PJ-05'])
    const withYo = rows.slice(1, 2).map((r) => ({ ...r, project: { ...r.project, name: 'Учёт паллет' } }))
    expect(filterRows(withYo, { tab: 'all', query: 'учет' })).toHaveLength(1)
  })
})

describe('address state', () => {
  it('round-trips tab and query and drops defaults', () => {
    const filter = { tab: 'saved', query: 'Химки' } as const
    expect(parseProjectsSearch(toProjectsSearch(filter))).toEqual(filter)
    expect(toProjectsSearch(EMPTY_FILTER).toString()).toBe('')
  })

  it('ignores an unknown tab', () => {
    expect(parseProjectsSearch(new URLSearchParams('tab=archived'))).toEqual(EMPTY_FILTER)
  })

  it('knows when a filter is active', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive({ tab: 'all', query: ' ' })).toBe(false)
    expect(isFilterActive({ tab: 'draft', query: '' })).toBe(true)
  })
})

describe('stageLabel', () => {
  it('uses the short stage names of PRD 11.1', () => {
    expect(['params', 'matching', 'simulation', 'economics'].map((s) => stageLabel(s as Parameters<typeof stageLabel>[0]))).toEqual([
      'Параметры', 'Подбор', 'Симуляция', 'Итог',
    ])
  })
})
