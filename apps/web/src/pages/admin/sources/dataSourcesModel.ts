import { canAutoRefresh, type DataSource } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.dataSources

/** Подпись под названием источника: кто его дал и в каком виде (А6, 15966:7293). */
export function sourceTypeLabel(source: Pick<DataSource, 'kind' | 'origin'>): string {
  if (source.origin === 'organizer') return source.kind === 'catalog' ? t.origin.organizerTable : t.origin.organizer
  return t.origin[source.origin]
}

/**
 * Подпись режима обновления рядом с переключателем: у ссылки — период или «вручную»,
 * у файла — «вручную · файл», у данных без файла и ссылки (справочники команды) — «после проверки».
 */
export function refreshLabel(source: Pick<DataSource, 'locator' | 'refresh'>): string {
  if (source.refresh !== 'manual') return t.refresh[source.refresh]
  if (canAutoRefresh(source)) return t.refresh.manual
  return source.locator === null ? t.refresh.manualReviewed : t.refresh.manualFile
}
