import { describe, expect, it } from 'vitest'
import { LAUNCH_ITEMS } from '@/mocks/fixtures/launchItems'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import {
  clearFilters,
  EMPTY_FILTER,
  hasFilters,
  entryName,
  filterCatalog,
  isFilterActive,
  parseCatalogSearch,
  priceRangeOf,
  resetFilters,
  robotFacilities,
  sortCatalog,
  toCatalogSearch,
  type CatalogFilter,
} from './catalogModel'

const run = (patch: Partial<CatalogFilter>) => filterCatalog(ROBOTS, LAUNCH_ITEMS, { ...EMPTY_FILTER, ...patch }, PROCESSES)
const names = (patch: Partial<CatalogFilter>) => run(patch).map(entryName)
const robot = (name: string) => {
  const found = ROBOTS.find((r) => r.name === name)
  if (!found) throw new Error(name)
  return found
}

describe('catalogModel (К-1)', () => {
  it('puts exactly 1 and 3 million into the lower price range (PRD 7.4, PRD 15 · №30)', () => {
    expect([999_999, 1_000_000, 1_000_001, 3_000_000, 3_000_001].map(priceRangeOf))
      .toEqual(['upTo1m', 'upTo1m', 'from1to3m', 'from1to3m', 'over3m'])
  })

  it('shows one tab at a time: robots, or launch items of the tab type (D-55)', () => {
    expect(run({})).toHaveLength(ROBOTS.length)
    expect(run({ tab: 'infrastructure' })).toHaveLength(13)
    expect(run({ tab: 'software' })).toHaveLength(6)
    expect(run({ tab: 'services' })).toHaveLength(10)
  })

  it('searches by name and by manufacturer or supplier, ignoring case and «ё»', () => {
    expect(names({ query: 'amr 8' })).toEqual(['AMR 800'])
    expect(names({ query: 'клеверкоптер' })).toEqual(['Курьер-30'])
    expect(names({ tab: 'software', query: 'умный' })).toHaveLength(4)
  })

  it('combines values inside a filter with OR and filters with AND (D-66)', () => {
    const classes = names({ operationClasses: ['OP-07', 'OP-05'] })
    expect(classes).toEqual(expect.arrayContaining(['РУБИ-С-03', 'АК-SC80', 'MARK 2 SE', 'Дельта-робот']))
    expect(names({ operationClasses: ['OP-07', 'OP-05'], industries: ['Промышленность'] })).toEqual(['Дельта-робот'])
  })

  it('keeps НИОКР selectable: Ronavi RCM is the rnd robot of the fixtures (D-73)', () => {
    expect(names({ readiness: ['rnd'] })).toEqual(['Ronavi RCM'])
  })

  it('derives the facility of a robot from processes of its classes (D-72)', () => {
    expect(robotFacilities(robot('AMR 800'), PROCESSES).has('warehouse')).toBe(true)
    expect(names({ facilities: ['warehouse'] })).toContain('AMR 800')
  })

  it('ignores robot-only filters on launch item tabs, but applies cost and price (D-72)', () => {
    expect(run({ tab: 'software', operationClasses: ['OP-01'] })).toHaveLength(6)
    expect(names({ tab: 'software', costTypes: ['opex'] })).toEqual(['Подписка на ПО управления парком'])
    expect(names({ tab: 'services', priceRanges: ['over3m'] })).toEqual([])
    expect(names({ costTypes: ['opex'] })).toEqual([])
  })

  it('sorts by price within one cost type, items priced in percent last (PRD 15 · №31)', () => {
    const sorted = sortCatalog(run({ tab: 'services' }), 'cheaper').map(entryName)
    expect(sorted.at(-1)).toBe('Сервисный контракт')
    expect(sorted.indexOf('Замена АКБ парка')).toBeLessThan(sorted.indexOf('Регламентное обслуживание (ППР)'))
    expect(sortCatalog(run({ query: 'AMR' }), 'pricier').map(entryName)).toEqual(['AMR 1500', 'AMR 800', 'AMR 100'])
  })

  it('sorts by TRL with unknown last, and by confirmed data first', () => {
    const byTrl = sortCatalog(run({}), 'trl').map(entryName)
    expect(byTrl.at(-1)).toBe('PuduBot 2')
    const byConfirmed = sortCatalog(run({}), 'confirmed')
    expect(byConfirmed[0]?.kind === 'robot' && byConfirmed[0].robot.specs.confidence).toBe('confirmed')
  })

  it('does not change the input when sorting', () => {
    const entries = run({})
    const before = entries.map(entryName)
    sortCatalog(entries, 'pricier')
    expect(entries.map(entryName)).toEqual(before)
  })

  it('round-trips the state through the address and drops unknown values', () => {
    const filter: CatalogFilter = {
      ...EMPTY_FILTER, tab: 'services', query: 'пилот', operationClasses: ['OP-01', 'OP-08'], industries: ['ЖКХ'],
      facilities: ['airport'], readiness: ['rnd'], costTypes: ['opex'], priceRanges: ['upTo1m'], sort: 'trl',
    }
    const params = toCatalogSearch(filter)
    expect(parseCatalogSearch(params, ['OP-01', 'OP-08'])).toEqual(filter)
    expect(parseCatalogSearch(new URLSearchParams('tab=x&class=OP-99&sort=y&price=cheap'), ['OP-01'])).toEqual(EMPTY_FILTER)
    expect(toCatalogSearch(EMPTY_FILTER).toString()).toBe('')
  })

  it('clears only filters for «Сбросить» of К-2, keeping search, tab and sort (D-74)', () => {
    const filter: CatalogFilter = { ...EMPTY_FILTER, tab: 'software', sort: 'cheaper', query: 'fleet', operationClasses: ['OP-01'], priceRanges: ['upTo1m'] }
    expect(hasFilters(filter)).toBe(true)
    expect(hasFilters({ ...EMPTY_FILTER, query: 'fleet' })).toBe(false)
    expect(clearFilters(filter)).toEqual({ ...EMPTY_FILTER, tab: 'software', sort: 'cheaper', query: 'fleet' })
  })

  it('narrows the robots to OP-01 for К-2 and keeps only robots of that class', () => {
    const robots = run({ operationClasses: ['OP-01'] })
    expect(robots.length).toBeGreaterThan(0)
    expect(robots.every((e) => e.kind === 'robot' && e.robot.operationClasses.some((c) => c.code === 'OP-01'))).toBe(true)
    expect(robots.map(entryName)).toEqual(expect.arrayContaining(['AMR 100', 'AMR 800', 'AK-2000-2']))
  })

  it('resets search and filters but keeps the tab and the sort', () => {
    const filter: CatalogFilter = { ...EMPTY_FILTER, tab: 'software', sort: 'cheaper', query: 'x', costTypes: ['capex'] }
    expect(isFilterActive(filter)).toBe(true)
    expect(resetFilters(filter)).toEqual({ ...EMPTY_FILTER, tab: 'software', sort: 'cheaper' })
  })
})
