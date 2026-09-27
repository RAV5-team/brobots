import { Plus } from 'lucide-react'
import { ROUTE_PATHS } from '@/app/routePaths'
import { MergedButtonLink } from '@/components/ui/MergedButton'
import { Search } from '@/components/ui/Search'
import { Select, type SelectOption } from '@/components/ui/Select'
import type { FacilityType, FacilityTypeCode } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import {
  COMPLETENESS_FILTERS, LOCATION_SORTS, PROJECTS_FILTERS,
  type CompletenessFilter, type LocationFilter, type LocationSort, type ProjectsFilter,
} from './locationsModel'

const t = ru.locations
/** Radix Select не принимает пустое значение опции: «все» — отдельная опция, после выбора снова видна подпись фильтра (D-30). */
const ALL = 'all'

const withAll = <T extends string>(allLabel: string, values: readonly T[], label: (v: T) => string): readonly SelectOption<string>[] =>
  [{ value: ALL, label: allLabel }, ...values.map((v) => ({ value: v, label: label(v) }))]

const fromOption = (value: string): string | null => (value === ALL ? null : value)

interface LocationFiltersProps {
  readonly filter: LocationFilter
  readonly onFilterChange: (filter: LocationFilter) => void
  readonly sort: LocationSort
  readonly onSortChange: (sort: LocationSort) => void
  readonly facilityTypes: readonly FacilityType[]
  readonly canAdd: boolean
}

/** Поиск, «Добавить локацию +», три фильтра и сортировка (PRD 10.1; 15950:1633). */
export function LocationFilters({ filter, onFilterChange, sort, onSortChange, facilityTypes, canAdd }: LocationFiltersProps) {
  const f = t.filters
  const facilityOptions = withAll(f.allFacilityTypes, facilityTypes.map((ft) => ft.code), (code) =>
    facilityTypes.find((ft) => ft.code === code)?.name ?? code)
  const completenessOptions = withAll(f.completenessOptions.all, COMPLETENESS_FILTERS, (v) => f.completenessOptions[v])
  const projectsOptions = withAll(f.projectsOptions.all, PROJECTS_FILTERS, (v) => f.projectsOptions[v])
  const sortOptions = LOCATION_SORTS.map((v) => ({ value: v, label: f.sortOptions[v] }))

  return (
    <div className="flex flex-col gap-16">
      <div className="flex items-center gap-8">
        <div className="flex-1">
          <Search label={t.search} value={filter.query} onChange={(e) => { onFilterChange({ ...filter, query: e.target.value }) }} />
        </div>
        {canAdd && <MergedButtonLink to={ROUTE_PATHS.locationNew} label={t.add} icon={Plus} />}
      </div>
      <div className="flex items-center gap-8">
        <Select
          variant="filter"
          aria-label={f.facilityType}
          placeholder={f.facilityType}
          options={facilityOptions}
          value={filter.facilityType ?? ''}
          onChange={(v) => { onFilterChange({ ...filter, facilityType: fromOption(v) as FacilityTypeCode | null }) }}
        />
        <Select
          variant="filter"
          aria-label={f.completeness}
          placeholder={f.completeness}
          options={completenessOptions}
          value={filter.completeness ?? ''}
          onChange={(v) => { onFilterChange({ ...filter, completeness: fromOption(v) as CompletenessFilter | null }) }}
        />
        <Select
          variant="filter"
          aria-label={f.projects}
          placeholder={f.projects}
          options={projectsOptions}
          value={filter.projects ?? ''}
          onChange={(v) => { onFilterChange({ ...filter, projects: fromOption(v) as ProjectsFilter | null }) }}
        />
        <div className="ml-auto">
          <Select variant="filter" aria-label={f.sort} options={sortOptions} value={sort} onChange={onSortChange} />
        </div>
      </div>
    </div>
  )
}
