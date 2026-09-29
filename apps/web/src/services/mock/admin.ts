import { CATALOG_REFRESH_RUN } from '@/mocks/fixtures/catalogRefresh'
import { DATA_SOURCES } from '@/mocks/fixtures/dataSources'
import { NORMS } from '@/mocks/fixtures/norms'
import { canAutoRefresh, type DataSource, type Norm, type NormChange } from '@/domain'
import type { AdminService } from '../admin'
import { NotFoundError, ValidationError } from '../errors'
import { respond, type MockOptions } from './respond'

export function createMockAdmin(options: MockOptions): AdminService {
  // Кадр записанного прогона: запуск — первый, каждый запрос статуса — следующий, последний повторяется.
  let frame = 0
  const current = () => CATALOG_REFRESH_RUN[frame] ?? { sources: [] }
  // Справочник живёт, пока жив набор сервисов: сохранение заменяет его новой копией.
  let norms: readonly Norm[] = NORMS
  let sources: readonly DataSource[] = DATA_SOURCES
  // Счётчик ключей новых источников: ключ не переиспользуется.
  let created = 0
  // Заменяет источник новой копией; нет такого ключа — ошибка, реестр не меняется.
  const replaceSource = (key: string, change: (source: DataSource) => DataSource): Promise<DataSource> => {
    const current = sources.find((source) => source.key === key)
    if (!current) return Promise.reject(new NotFoundError(`Источник ${key} не найден`))
    const next = change(current)
    sources = sources.map((source) => (source.key === key ? next : source))
    return respond(next, options)
  }
  return {
    listDataSources: () => respond(sources, options),
    createDataSource: (input) => {
      if (input.refresh !== 'manual' && !canAutoRefresh(input)) {
        return Promise.reject(new ValidationError({ kind: 'refreshNeedsUrl' }, 'Автообновление доступно только для источника по ссылке — файл обновляется загрузкой нового'))
      }
      const sameName = (name: string) => name.trim().toLocaleLowerCase('ru') === input.name.trim().toLocaleLowerCase('ru')
      if (sources.some((source) => sameName(source.name))) {
        return Promise.reject(new ValidationError({ kind: 'dataSourceDuplicate', name: input.name }, `Источник «${input.name}» уже есть в реестре`))
      }
      created += 1
      const source: DataSource = { ...input, key: `source_${String(created)}`, actualizedOn: `${input.actualizedOn}T00:00:00Z` }
      sources = [...sources, source]
      return respond(source, options)
    },
    updateDataSource: (key, patch) => {
      const current = sources.find((source) => source.key === key)
      if (current && patch.refresh !== 'manual' && !canAutoRefresh(current)) {
        return Promise.reject(new ValidationError({ kind: 'refreshNeedsUrl' }, 'Автообновление доступно только для источника по ссылке — файл обновляется загрузкой нового'))
      }
      return replaceSource(key, (source) => ({ ...source, ...patch }))
    },
    // Проверки ссылки в API нет (D-52): мок считает недоступными адреса в зоне .invalid (RFC 2606),
    // остальные — открывшимися сегодня.
    checkDataSourceUrl: (url) => {
      const host = URL.canParse(url) ? new URL(url).hostname : ''
      if (host === '' || host.endsWith('.invalid')) return respond({ reachable: false } as const, options)
      return respond({ reachable: true, lastModified: new Date().toISOString() } as const, options)
    },
    // Настоящий опрос источника — вне рамок API (docs/api, план А6): мок только сдвигает дату актуализации.
    refreshDataSource: (key) => replaceSource(key, (source) => ({ ...source, actualizedOn: new Date().toISOString() })),
    startCatalogRefresh: () => {
      frame = 0
      return respond(current(), options)
    },
    getCatalogRefresh: () => {
      frame = Math.min(frame + 1, CATALOG_REFRESH_RUN.length - 1)
      return respond(current(), options)
    },
    listNorms: () => respond(norms, options),
    saveNorms: (changes) => {
      const unknown = changes.find((change) => !norms.some((norm) => norm.code === change.code))
      if (unknown) return Promise.reject(new NotFoundError(`Норматив ${unknown.code} не найден`))
      norms = applyNormChanges(norms, changes)
      return respond(norms, options)
    },
  }
}

function applyNormChanges(norms: readonly Norm[], changes: readonly NormChange[]): readonly Norm[] {
  const byCode = new Map(changes.map((change) => [change.code, change.value]))
  return norms.map((norm) => {
    const value = byCode.get(norm.code)
    return value === undefined ? norm : { ...norm, value }
  })
}
