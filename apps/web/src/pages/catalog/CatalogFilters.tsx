import { X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { FILTER_PILL_CLASSES } from '@/components/ui/buttonStyles'
import { MultiSelectFilter, type MultiSelectGroup, type MultiSelectOption } from '@/components/ui/MultiSelectFilter'
import { Search } from '@/components/ui/Search'
import { TextButton } from '@/components/ui/TextLink'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import type { FacilityType, OperationClass } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { CompareLocationState } from './compare/comparePaths'
import {
  CATALOG_TABS,
  clearFilters,
  hasFilters,
  COST_TYPES,
  INDUSTRIES,
  PRICE_RANGES,
  READINESS_VALUES,
  SORT_KEYS,
  type CatalogFilter,
  type CostTypeFilter,
  type PriceRange,
  type ReadinessFilter,
  type SortKey,
} from './catalogModel'

const t = ru.catalog

const TAB_OPTIONS = CATALOG_TABS.map((tab) => ({ value: tab, label: t.tabs[tab] }))
const INDUSTRY_OPTIONS: readonly MultiSelectOption<string>[] = INDUSTRIES.map((i) => ({ value: i, label: i }))
const READINESS_OPTIONS: readonly MultiSelectOption<ReadinessFilter>[] = READINESS_VALUES.map((r) => ({ value: r, label: t.filters.readinessOptions[r] }))
const SORT_OPTIONS = SORT_KEYS.map((key) => ({ value: key, label: t.sort[key] }))

/** «Стоимость» — две группы, работают вместе (PRD 7.4). Значения групп различаются префиксом. */
type CostValue = `cost:${CostTypeFilter}` | `price:${PriceRange}`
const COST_GROUPS: readonly MultiSelectGroup<CostValue>[] = [
  { label: t.filters.costTypeGroup, options: COST_TYPES.map((c) => ({ value: `cost:${c}` as const, label: t.filters.costTypes[c] })) },
  { label: t.filters.priceGroup, options: PRICE_RANGES.map((p) => ({ value: `price:${p}` as const, label: t.filters.priceRanges[p] })) },
]

interface CatalogFiltersProps {
  readonly filter: CatalogFilter
  readonly onChange: (filter: CatalogFilter) => void
  readonly operationClasses: readonly OperationClass[]
  readonly facilityTypes: readonly FacilityType[]
  readonly compareCount: number
  /** Название робота активного фильтра «Совместимо с …» (D-79); null — фильтра нет. */
  readonly compatibleName: string | null
}

/** Шапка фильтров К-1 (16642:629): поиск и вкладки, ниже — пять фильтров, «Сравнить (N)» и сортировка. */
export function CatalogFilters({ filter, onChange, operationClasses, facilityTypes, compareCount, compatibleName }: CatalogFiltersProps) {
  const navigate = useNavigate()
  // «← Назад к результатам» на К-3 вернёт к этой выборке.
  const { search } = useLocation()
  const set = (patch: Partial<CatalogFilter>) => { onChange({ ...filter, ...patch }) }
  // Класс, отрасль, тип объекта и готовность есть только у роботов (D-72).
  const robotOnly = filter.tab !== 'robots'
  const costValue: readonly CostValue[] = [
    ...filter.costTypes.map((c) => `cost:${c}` as const),
    ...filter.priceRanges.map((p) => `price:${p}` as const),
  ]

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-12">
        <div className="flex-1">
          <Search label={t.search} value={filter.query} onChange={(e) => { set({ query: e.target.value }) }} />
        </div>
        <Segmented label={t.tabsLabel} fit="content" options={TAB_OPTIONS} value={filter.tab} onChange={(tab) => { set({ tab }) }} />
      </div>
      {/* Зазор 4, как на К-2 (16642:2299): с активной кнопкой и «Сбросить» ряд помещается в 1078 (D-74). */}
      <div className="flex flex-wrap items-center gap-4">
        <MultiSelectFilter
          label={t.filters.operationClass}
          options={operationClasses.map((c) => ({ value: c.code, label: t.filters.classOption(c.code, c.name), buttonLabel: c.code }))}
          value={filter.operationClasses}
          onChange={(operationClasses) => { set({ operationClasses }) }}
          disabled={robotOnly}
          hint={robotOnly ? t.filters.notForTab : undefined}
        />
        <MultiSelectFilter
          label={t.filters.industry}
          searchLabel={t.filters.industrySearch}
          options={INDUSTRY_OPTIONS}
          value={filter.industries}
          onChange={(industries) => { set({ industries }) }}
          disabled={robotOnly}
          hint={robotOnly ? t.filters.notForTab : undefined}
        />
        <MultiSelectFilter
          label={t.filters.facility}
          options={facilityTypes.map((f) => ({ value: f.code, label: f.name }))}
          value={filter.facilities}
          onChange={(facilities) => { set({ facilities }) }}
          disabled={robotOnly}
          hint={robotOnly ? t.filters.notForTab : undefined}
        />
        <MultiSelectFilter
          label={t.filters.readiness}
          options={READINESS_OPTIONS}
          value={filter.readiness}
          onChange={(readiness) => { set({ readiness }) }}
          disabled={robotOnly}
          hint={robotOnly ? t.filters.notForTab : undefined}
        />
        <MultiSelectFilter
          label={t.filters.cost}
          groups={COST_GROUPS}
          value={costValue}
          onChange={(v) => {
            set({
              costTypes: v.filter((x) => x.startsWith('cost:')).map((x) => x.slice('cost:'.length) as CostTypeFilter),
              priceRanges: v.filter((x) => x.startsWith('price:')).map((x) => x.slice('price:'.length) as PriceRange),
            })
          }}
        />
        {compatibleName !== null && (
          <span data-active="true" className={FILTER_PILL_CLASSES}>
            {t.filters.compatibleWith(compatibleName)}
            <button
              type="button"
              aria-label={t.filters.clearCompatible(compatibleName)}
              onClick={() => { set({ compatibleWith: null }) }}
              className="-mr-4 flex size-24 items-center justify-center rounded-full hover:bg-inverse-hover"
            >
              <X aria-hidden size={12} strokeWidth={2.5} />
            </button>
          </span>
        )}
        {hasFilters(filter) && (
          <TextButton variant="subtle" onClick={() => { onChange(clearFilters(filter)) }}>{t.filters.reset}</TextButton>
        )}
        <div className="flex-1" />
        {/* Активна и при нуле, как на К-1: пустой набор объясняет экран сравнения К-3. */}
        <button type="button" className={FILTER_PILL_CLASSES} onClick={() => { void navigate(ROUTE_PATHS.catalogCompare, { state: { catalogSearch: search } satisfies CompareLocationState }) }}>
          {t.compare.open(compareCount)}
        </button>
        <Select
          variant="filter"
          aria-label={t.sortLabel}
          options={SORT_OPTIONS}
          value={filter.sort}
          onChange={(sort: SortKey) => { set({ sort }) }}
        />
      </div>
    </div>
  )
}
