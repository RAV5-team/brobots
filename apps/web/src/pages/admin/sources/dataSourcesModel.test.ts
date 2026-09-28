import { describe, expect, it } from 'vitest'
import { canAutoRefresh, type DataSource } from '@/domain'
import { DATA_SOURCES } from '@/mocks/fixtures/dataSources'
import { refreshLabel, sourceTypeLabel } from './dataSourcesModel'

const source = (key: string): DataSource => {
  const found = DATA_SOURCES.find((s) => s.key === key)
  if (!found) throw new Error(key)
  return found
}

describe('dataSourcesModel (экран А6)', () => {
  it('names the source type as on the mockup: organizer table, organizer data, open source, internal reference', () => {
    expect(sourceTypeLabel(source('catalog_v4'))).toBe('таблица организатора')
    expect(sourceTypeLabel(source('datasets'))).toBe('данные организатора')
    expect(sourceTypeLabel(source('vendor_sites'))).toBe('открытый источник')
    expect(sourceTypeLabel(source('norms'))).toBe('внутренний справочник')
  })

  it('describes the refresh mode: period for links, «вручную · файл» for files, «после проверки» for internal data', () => {
    expect(refreshLabel(source('vendor_sites'))).toBe('раз в месяц')
    expect(refreshLabel({ ...source('vendor_sites'), refresh: 'weekly' })).toBe('раз в неделю')
    expect(refreshLabel({ ...source('vendor_sites'), refresh: 'manual' })).toBe('вручную')
    expect(refreshLabel(source('catalog_v4'))).toBe('вручную · файл')
    expect(refreshLabel(source('norms'))).toBe('вручную · после проверки')
  })

  it('allows auto-refresh only for a source with a link (PRD 6.10)', () => {
    expect(canAutoRefresh(source('vendor_sites'))).toBe(true)
    expect(canAutoRefresh(source('catalog_v4'))).toBe(false)
    expect(canAutoRefresh(source('norms'))).toBe(false)
  })
})
