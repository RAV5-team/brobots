import type { IsoDateTime } from './common'

export type DataSourceStatus = 'confirmed' | 'estimate'

/** Источник данных каталога и нормативов (экран А6). */
export interface DataSource {
  readonly key: string
  readonly name: string
  readonly kind: 'catalog' | 'cases' | 'specs' | 'dataset' | 'prices'
  readonly origin: 'organizer' | 'open' | 'internal'
  readonly locator: { readonly kind: 'file'; readonly fileName: string } | { readonly kind: 'url'; readonly url: string } | null
  readonly status: DataSourceStatus
  readonly provides: string
  readonly actualizedOn: IsoDateTime
  readonly refresh: 'manual' | 'monthly'
}
