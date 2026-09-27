import { describe, expect, it } from 'vitest'
import { isCatalogRefreshDone, catalogRefreshStep, type CatalogRefresh, type SourcePollStatus } from './catalogRefresh'

const run = (...statuses: SourcePollStatus[]): CatalogRefresh => ({
  sources: statuses.map((status, i) => ({ key: `s${String(i)}`, label: `Источник ${String(i)}`, status, received: status === 'received' ? 1 : null })),
})

describe('catalogRefreshStep (А1а «Опрашиваем источники · 2 из 3», D-37)', () => {
  it('counts sources whose polling has started, not only those that answered', () => {
    expect(catalogRefreshStep(run('waiting', 'queued', 'queued'))).toBe(1)
    expect(catalogRefreshStep(run('received', 'waiting', 'queued'))).toBe(2)
    expect(catalogRefreshStep(run('received', 'received', 'failed'))).toBe(3)
  })

  it('is zero before any source is polled', () => {
    expect(catalogRefreshStep(run('queued', 'queued'))).toBe(0)
  })
})

describe('isCatalogRefreshDone', () => {
  it('is done when every source answered or failed', () => {
    expect(isCatalogRefreshDone(run('received', 'failed'))).toBe(true)
    expect(isCatalogRefreshDone(run('received', 'waiting'))).toBe(false)
    expect(isCatalogRefreshDone(run('received', 'queued'))).toBe(false)
  })

  it('treats an empty poll as done', () => {
    expect(isCatalogRefreshDone({ sources: [] })).toBe(true)
  })
})
