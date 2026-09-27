import type { IsoDateTime } from './common'

export type DataSourceStatus = 'confirmed' | 'estimate'

/** Период автообновления источника по ссылке — `refresh_schedule` API без «вручную». */
export type DataSourceRefreshPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

/** Автообновление: вручную или по периоду (`refresh_schedule` API, `RefreshSchedules`). */
export type DataSourceRefresh = 'manual' | DataSourceRefreshPeriod

/** Периоды в порядке списка окна А7б: от частого к редкому. */
export const DATA_SOURCE_REFRESH_PERIODS: readonly DataSourceRefreshPeriod[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly']

/** Что даёт источник — `source_type` API. */
export type DataSourceKind = 'catalog' | 'cases' | 'specs' | 'dataset' | 'prices' | 'norms'

export type DataSourceLocator = { readonly kind: 'file'; readonly fileName: string } | { readonly kind: 'url'; readonly url: string }

/** Источник данных каталога и нормативов (экран А6). */
export interface DataSource {
  readonly key: string
  readonly name: string
  readonly kind: DataSourceKind
  readonly origin: 'organizer' | 'open' | 'internal'
  readonly locator: DataSourceLocator | null
  readonly status: DataSourceStatus
  readonly provides: string
  readonly actualizedOn: IsoDateTime
  readonly refresh: DataSourceRefresh
}

/**
 * Итог «Проверить» в окне А7б: страница открылась — с датой последнего изменения, если сервер её сообщил;
 * не открылась — источник всё равно можно добавить, но опрос каталога не получит данных.
 */
export type DataSourceUrlCheck =
  | { readonly reachable: true; readonly lastModified: IsoDateTime | null }
  | { readonly reachable: false }

/** Новый источник из окна А7 (POST /data-sources). Дата — календарная YYYY-MM-DD. */
export interface NewDataSource {
  readonly name: string
  readonly kind: DataSourceKind
  readonly origin: DataSource['origin']
  readonly locator: DataSourceLocator
  readonly status: DataSourceStatus
  readonly provides: string
  readonly actualizedOn: string
  readonly refresh: DataSourceRefresh
}

/** Изменяемые поля источника (PATCH /data-sources): пока только режим автообновления. */
export interface DataSourcePatch {
  readonly refresh: DataSourceRefresh
}

/** Автообновление возможно только у источника со ссылкой: файл обновляется загрузкой нового (PRD 6.10). */
export function canAutoRefresh(source: Pick<DataSource, 'locator'>): boolean {
  return source.locator?.kind === 'url'
}
