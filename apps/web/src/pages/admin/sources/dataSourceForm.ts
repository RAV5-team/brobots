import type { DataSource, DataSourceKind, DataSourceLocator, DataSourceRefresh, DataSourceRefreshPeriod, DataSourceStatus, NewDataSource } from '@/domain'
import { parseDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

/** Выбранный файл: имя и размер для строки «moros_amr800_spec.pdf · 2,4 МБ». */
export interface PickedFile {
  readonly name: string
  readonly size: number
}

/**
 * Значения окна А7 / А7б как их ввёл администратор; дата и ссылка — как напечатаны.
 * Файл и ссылка хранятся оба: переключение «Файл · Ссылка» не стирает введённое, в источник идёт выбранный вариант.
 */
export interface DataSourceForm {
  readonly name: string
  readonly kind: DataSourceKind | ''
  readonly locatorKind: DataSourceLocator['kind']
  readonly file: PickedFile | null
  readonly url: string
  readonly status: DataSourceStatus
  /** Автообновление и его период — только у ссылки (PRD 6.10). */
  readonly autoRefresh: boolean
  readonly refreshPeriod: DataSourceRefreshPeriod
  readonly actualizedOn: string
}

export type DataSourceField = 'name' | 'kind' | 'file' | 'url' | 'actualizedOn'

export type DataSourceFieldError = 'required' | 'duplicate' | 'invalidDate' | 'futureDate' | 'invalidUrl'

export type DataSourceFormErrors = Readonly<Partial<Record<DataSourceField, DataSourceFieldError>>>

/** Порядок типов в списке окна: первым — «ТТХ решений», как в макете (15966:7660). */
export const DATA_SOURCE_KINDS: readonly DataSourceKind[] = ['specs', 'prices', 'cases', 'catalog', 'dataset', 'norms']

/**
 * «Подтверждено» выбрано, как в макете (15966:7678): статус обязателен и пустым не бывает.
 * У ссылки автообновление включено раз в неделю, как в А7б (15966:7946, 15966:7948).
 */
export const EMPTY_DATA_SOURCE_FORM: DataSourceForm = {
  name: '',
  kind: '',
  locatorKind: 'file',
  file: null,
  url: '',
  status: 'confirmed',
  autoRefresh: true,
  refreshPeriod: 'weekly',
  actualizedOn: '',
}

/** Название для сравнения: без регистра, лишних пробелов и различия «е» / «ё». */
const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е')

function dateError(typed: string, today: string): DataSourceFieldError | undefined {
  if (typed.trim() === '') return 'required'
  const date = parseDate(typed)
  if (date === null) return 'invalidDate'
  // Календарные YYYY-MM-DD сравниваются как строки.
  return date > today ? 'futureDate' : undefined
}

/** Адрес страницы целиком: http(s) и хост. «moros.ru/catalog» без схемы не принимаем — опрос каталога его не откроет. */
function urlError(typed: string): DataSourceFieldError | undefined {
  const url = typed.trim()
  if (url === '') return 'required'
  if (!URL.canParse(url)) return 'invalidUrl'
  const { protocol, hostname } = new URL(url)
  return (protocol === 'http:' || protocol === 'https:') && hostname !== '' ? undefined : 'invalidUrl'
}

/**
 * Проверка перед добавлением (PRD 6.10): обязательные поля, дата актуализации не позже сегодня [ТЗ 3.3.4]
 * и название, которого ещё нет в реестре — иначе в отчёте появятся два одинаковых источника.
 */
export function validateDataSourceForm(
  form: DataSourceForm,
  existing: readonly Pick<DataSource, 'name'>[],
  today: string,
): DataSourceFormErrors {
  const isDuplicate = existing.some((source) => normalizeName(source.name) === normalizeName(form.name))
  const nameError = form.name.trim() === '' ? 'required' : isDuplicate ? 'duplicate' : undefined
  const found: Record<DataSourceField, DataSourceFieldError | undefined> = {
    name: nameError,
    kind: form.kind === '' ? 'required' : undefined,
    file: form.locatorKind === 'file' && form.file === null ? 'required' : undefined,
    url: form.locatorKind === 'url' ? urlError(form.url) : undefined,
    actualizedOn: dateError(form.actualizedOn, today),
  }
  return Object.fromEntries(Object.entries(found).filter(([, error]) => error !== undefined))
}

function toLocator(form: DataSourceForm): DataSourceLocator {
  if (form.locatorKind === 'url') return { kind: 'url', url: form.url.trim() }
  if (form.file === null) throw new Error('Форма источника не проверена')
  return { kind: 'file', fileName: form.file.name }
}

/** Файл обновляется загрузкой нового — автообновления у него нет (PRD 6.10). */
const toRefresh = (form: DataSourceForm): DataSourceRefresh =>
  form.locatorKind === 'url' && form.autoRefresh ? form.refreshPeriod : 'manual'

/**
 * Источник для POST /data-sources. Проверенная форма обязательна: тип, файл или ссылка и дата уже есть.
 * Происхождение — «открытый источник»: данные организатора приходят импортом (А4), справочники команды — внутренние (D-51).
 * «Что даёт» — тип источника, пока администратор не уточнит его в карточке.
 */
export function toNewDataSource(form: DataSourceForm): NewDataSource {
  const actualizedOn = parseDate(form.actualizedOn)
  if (form.kind === '' || actualizedOn === null) throw new Error('Форма источника не проверена')
  return {
    name: form.name.trim(),
    kind: form.kind,
    origin: 'open',
    locator: toLocator(form),
    status: form.status,
    provides: ru.dataSources.kinds[form.kind],
    actualizedOn,
    refresh: toRefresh(form),
  }
}
