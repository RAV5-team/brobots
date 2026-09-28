import { generatePath } from 'react-router'
import { formatRubMillions } from '@/shared/format/money'
import { ru } from '@/shared/i18n/ru'
import { ROUTE_PATHS } from '@/app/routePaths'
import {
  specsCompleteness,
  type CompareEntry,
  type FacilityTypeCode,
  type LaunchItem,
  type LaunchItemType,
  type OperationClassCode,
  type Process,
  type Robot,
  type RobotId,
  type RobotReadiness,
} from '@/domain'

/** Вкладки каталога — фильтр по типу позиции (D-55); «Сервисы» — услуги внедрения и поддержка (PRD 7.5). */
export const CATALOG_TABS = ['robots', 'infrastructure', 'software', 'services'] as const
export type CatalogTab = (typeof CATALOG_TABS)[number]

const TAB_ITEM_TYPES: Record<Exclude<CatalogTab, 'robots'>, readonly LaunchItemType[]> = {
  infrastructure: ['infrastructure'],
  software: ['software'],
  services: ['service', 'support'],
}

export const INDUSTRIES = ru.catalog.industries

export type ReadinessFilter = Exclude<RobotReadiness, 'unknown'>
export const READINESS_VALUES: readonly ReadinessFilter[] = ['operation', 'pilot', 'rnd']

export type CostTypeFilter = 'capex' | 'opex'
export const COST_TYPES: readonly CostTypeFilter[] = ['capex', 'opex']

export type PriceRange = 'upTo1m' | 'from1to3m' | 'over3m'
export const PRICE_RANGES: readonly PriceRange[] = ['upTo1m', 'from1to3m', 'over3m']

export const SORT_KEYS = ['relevance', 'cheaper', 'pricier', 'trl', 'confirmed'] as const
export type SortKey = (typeof SORT_KEYS)[number]

/** Состояние фильтров — массивы значений (мультивыбор), сортировка — одно значение (D-66). */
export interface CatalogFilter {
  readonly tab: CatalogTab
  readonly query: string
  readonly operationClasses: readonly OperationClassCode[]
  readonly industries: readonly string[]
  readonly facilities: readonly FacilityTypeCode[]
  readonly readiness: readonly ReadinessFilter[]
  readonly costTypes: readonly CostTypeFilter[]
  readonly priceRanges: readonly PriceRange[]
  /** «Совместимо с <робот>» — со страницы решения К-4 (D-79): позиции для запуска, где робот указан по id. */
  readonly compatibleWith: RobotId | null
  readonly sort: SortKey
}

export const EMPTY_FILTER: CatalogFilter = {
  tab: 'robots', query: '', operationClasses: [], industries: [], facilities: [], readiness: [], costTypes: [], priceRanges: [], compatibleWith: null, sort: 'relevance',
}

export type CatalogEntry =
  | { readonly kind: 'robot'; readonly robot: Robot }
  | { readonly kind: 'launch-item'; readonly item: LaunchItem }

export const entryRef = (entry: CatalogEntry): CompareEntry =>
  entry.kind === 'robot' ? { kind: 'robot', id: entry.robot.id } : { kind: 'launch-item', id: entry.item.id }

/** Адрес страницы позиции (D-57, D-68). */
export const catalogItemPath = (itemId: string): string => generatePath(ROUTE_PATHS.catalogItem, { itemId })

/** Цена позиции для запуска: рубли или процент от CAPEX в год. */
export const launchItemPrice = (item: LaunchItem): string =>
  item.price.kind === 'rub' ? formatRubMillions(item.price.amountRub) : ru.catalog.card.percentOfCapex(item.price.percent)

export const entryName = (entry: CatalogEntry): string => (entry.kind === 'robot' ? entry.robot.name : entry.item.name)

const MILLION = 1_000_000
const PRICE_BOUNDS = { lower: 1 * MILLION, upper: 3 * MILLION } as const

/** Диапазон цены: ровно 1 и 3 млн ₽ — в нижний диапазон (PRD 7.4, PRD 15 · №30). */
export function priceRangeOf(priceRub: number): PriceRange {
  if (priceRub <= PRICE_BOUNDS.lower) return 'upTo1m'
  if (priceRub <= PRICE_BOUNDS.upper) return 'from1to3m'
  return 'over3m'
}

/** Цена в рублях; у позиции «10 % CAPEX в год» и у робота без цены — null. */
function priceRubOf(entry: CatalogEntry): number | null {
  if (entry.kind === 'robot') return entry.robot.priceRub
  return entry.item.price.kind === 'rub' ? entry.item.price.amountRub : null
}

/** Робот — всегда разовая покупка (CAPEX); у позиции — её тип затрат. */
function costTypeOf(entry: CatalogEntry): CostTypeFilter {
  if (entry.kind === 'robot') return 'capex'
  return entry.item.costType === 'capex' ? 'capex' : 'opex'
}

/**
 * Типы объектов робота выводятся из данных: процессы с классом операции робота и их «где применяется» (D-72).
 * Прямой привязки позиций к складу, аэропорту и медучреждению в каталоге нет (PRD 15, требование ТЗ 3.3.1).
 */
export function robotFacilities(robot: Robot, processes: readonly Process[]): ReadonlySet<FacilityTypeCode> {
  const classes = new Set(robot.operationClasses.map((c) => c.code))
  return new Set(processes.filter((p) => classes.has(p.operationClass)).flatMap((p) => p.facilityTypes))
}

const normalize = (text: string) => text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')

function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const [name, maker] = entry.kind === 'robot' ? [entry.robot.name, entry.robot.manufacturer] : [entry.item.name, entry.item.supplier]
  return normalize(name).includes(q) || normalize(maker).includes(q)
}

const anyOf = <T,>(selected: readonly T[], test: (value: T) => boolean) => selected.length === 0 || selected.some(test)

function matchesRobotFilters(robot: Robot, filter: CatalogFilter, processes: readonly Process[]): boolean {
  const facilities = filter.facilities.length > 0 ? robotFacilities(robot, processes) : null
  return anyOf(filter.operationClasses, (code) => robot.operationClasses.some((c) => c.code === code))
    && anyOf(filter.industries, (industry) => robot.industries.includes(industry))
    && anyOf(filter.facilities, (code) => facilities?.has(code) ?? false)
    && anyOf(filter.readiness, (value) => robot.readiness === value)
}

function matchesCost(entry: CatalogEntry, filter: CatalogFilter): boolean {
  const price = priceRubOf(entry)
  return anyOf(filter.costTypes, (type) => costTypeOf(entry) === type)
    && anyOf(filter.priceRanges, (range) => price !== null && priceRangeOf(price) === range)
}

const matchesCompatibility = (entry: CatalogEntry, robotId: RobotId | null) =>
  robotId === null || entry.kind === 'robot' || entry.item.compatibleWith.some((ref) => ref.kind === 'robot' && ref.id === robotId)

/** Позиции вкладки после поиска и фильтров. Фильтры робота к позициям для запуска не применяются (D-72). */
export function filterCatalog(
  robots: readonly Robot[], items: readonly LaunchItem[], filter: CatalogFilter, processes: readonly Process[],
): readonly CatalogEntry[] {
  const entries: readonly CatalogEntry[] = filter.tab === 'robots'
    ? robots.filter((r) => matchesRobotFilters(r, filter, processes)).map((robot) => ({ kind: 'robot', robot }))
    : items.filter((i) => TAB_ITEM_TYPES[filter.tab as Exclude<CatalogTab, 'robots'>].includes(i.type)).map((item) => ({ kind: 'launch-item', item }))
  return entries.filter((e) => matchesQuery(e, filter.query) && matchesCost(e, filter) && matchesCompatibility(e, filter.compatibleWith))
}

const CONFIDENCE_RANK = { confirmed: 0, partial: 1, unconfirmed: 2 } as const

/** Доля подтверждённых данных: у робота — по статусу ТТХ, у позиции — по характеристикам (D-64). */
function confirmedRank(entry: CatalogEntry): number {
  if (entry.kind === 'robot') return CONFIDENCE_RANK[entry.robot.specs.confidence]
  const { specs } = entry.item
  return specs.length === 0 ? 1 : 1 - specs.filter((s) => s.status === 'confirmed').length / specs.length
}

const COST_ORDER: Record<CostTypeFilter, number> = { capex: 0, opex: 1 }

/**
 * Цена сравнивается внутри одного типа затрат: сначала CAPEX, затем OPEX в год; позиции без цены в рублях — в конце
 * (PRD 7.4, PRD 15 · №31). Остальное — в порядке данных.
 */
function byPrice(direction: 1 | -1) {
  return (a: CatalogEntry, b: CatalogEntry) => {
    const pa = priceRubOf(a)
    const pb = priceRubOf(b)
    if (pa === null || pb === null) return (pa === null ? 1 : 0) - (pb === null ? 1 : 0)
    return COST_ORDER[costTypeOf(a)] - COST_ORDER[costTypeOf(b)] || direction * (pa - pb)
  }
}

const trlOf = (entry: CatalogEntry) => (entry.kind === 'robot' ? entry.robot.trl : null)
const completenessOf = (entry: CatalogEntry) => (entry.kind === 'robot' ? specsCompleteness(entry.robot.specs) : 0)

const COMPARATORS: Record<SortKey, (a: CatalogEntry, b: CatalogEntry) => number> = {
  // Вне проекта релевантность — полнота данных (предложение PRD 7.4); совпадение с фильтром уже отобрано фильтром.
  relevance: (a, b) => completenessOf(b) - completenessOf(a),
  cheaper: byPrice(1),
  pricier: byPrice(-1),
  trl: (a, b) => (trlOf(b) ?? -1) - (trlOf(a) ?? -1),
  confirmed: (a, b) => confirmedRank(a) - confirmedRank(b),
}

/** Сортировка без изменения входного массива; равные позиции сохраняют порядок данных. */
export function sortCatalog(entries: readonly CatalogEntry[], sort: SortKey): readonly CatalogEntry[] {
  return [...entries].sort(COMPARATORS[sort])
}

export const isFilterActive = (filter: CatalogFilter): boolean => filter.query.trim() !== '' || hasFilters(filter)

/** Выбран хотя бы один фильтр — показать «Сбросить» в ряду фильтров (PRD 7.4); поиск фильтром не считается. */
export const hasFilters = (filter: CatalogFilter): boolean =>
  [filter.operationClasses, filter.industries, filter.facilities, filter.readiness, filter.costTypes, filter.priceRanges].some((v) => v.length > 0)
  || filter.compatibleWith !== null

/** «Сбросить» у фильтров (К-2): снимает все фильтры, поиск, вкладку и сортировку оставляет (D-74). */
export const clearFilters = (filter: CatalogFilter): CatalogFilter => ({
  ...filter, operationClasses: [], industries: [], facilities: [], readiness: [], costTypes: [], priceRanges: [], compatibleWith: null,
})

/** Сбросить поиск и фильтры, оставив вкладку и сортировку: «Сбросить фильтры» в пустой выдаче. */
export const resetFilters = (filter: CatalogFilter): CatalogFilter => ({ ...EMPTY_FILTER, tab: filter.tab, sort: filter.sort })

// Состояние в адресе: вкладка, поиск, фильтры и сортировка — чтобы выборкой можно было поделиться.
const PARAM = {
  tab: 'tab', query: 'q', operationClasses: 'class', industries: 'industry', facilities: 'facility',
  readiness: 'readiness', costTypes: 'cost', priceRanges: 'price', compatibleWith: 'compat', sort: 'sort',
} as const

const oneOf = <T extends string>(allowed: readonly T[], value: string | null, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback
const allOf = <T extends string>(allowed: readonly T[] | null, values: readonly string[]): readonly T[] =>
  values.filter((v): v is T => allowed === null || allowed.includes(v as T))

export function parseCatalogSearch(params: URLSearchParams, operationClasses: readonly OperationClassCode[]): CatalogFilter {
  return {
    tab: oneOf(CATALOG_TABS, params.get(PARAM.tab), EMPTY_FILTER.tab),
    query: params.get(PARAM.query) ?? '',
    operationClasses: allOf(operationClasses, params.getAll(PARAM.operationClasses)),
    industries: allOf<string>(INDUSTRIES, params.getAll(PARAM.industries)),
    facilities: allOf<FacilityTypeCode>(['warehouse', 'airport', 'medical'], params.getAll(PARAM.facilities)),
    readiness: allOf(READINESS_VALUES, params.getAll(PARAM.readiness)),
    costTypes: allOf(COST_TYPES, params.getAll(PARAM.costTypes)),
    priceRanges: allOf(PRICE_RANGES, params.getAll(PARAM.priceRanges)),
    compatibleWith: /^RB-\d+$/.test(params.get(PARAM.compatibleWith) ?? '') ? (params.get(PARAM.compatibleWith) as RobotId) : null,
    sort: oneOf(SORT_KEYS, params.get(PARAM.sort), EMPTY_FILTER.sort),
  }
}

export function toCatalogSearch(filter: CatalogFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.tab !== EMPTY_FILTER.tab) params.set(PARAM.tab, filter.tab)
  if (filter.query) params.set(PARAM.query, filter.query)
  const lists = ['operationClasses', 'industries', 'facilities', 'readiness', 'costTypes', 'priceRanges'] as const
  for (const key of lists) for (const value of filter[key]) params.append(PARAM[key], value)
  if (filter.compatibleWith) params.set(PARAM.compatibleWith, filter.compatibleWith)
  if (filter.sort !== EMPTY_FILTER.sort) params.set(PARAM.sort, filter.sort)
  return params
}
