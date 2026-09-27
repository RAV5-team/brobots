import { Plus } from 'lucide-react'
import { ROUTE_PATHS } from '@/app/routePaths'
import { MergedButtonLink } from '@/components/ui/MergedButton'
import { Search } from '@/components/ui/Search'
import { Select, type SelectOption } from '@/components/ui/Select'
import type { FacilityType, FacilityTypeCode, OperationClass, OperationClassCode } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { ProcessFilter } from './processesModel'

const t = ru.processes
/** Radix Select не принимает пустое значение опции: «все» — отдельная опция, после выбора снова видна подпись фильтра. */
const ALL = 'all'

interface ProcessFiltersProps {
  readonly filter: ProcessFilter
  readonly onChange: (filter: ProcessFilter) => void
  readonly operationClasses: readonly OperationClass[]
  readonly facilityTypes: readonly FacilityType[]
  readonly canCreate: boolean
}

/** Поиск, «Создать новый процесс +» и два фильтра (PRD 9.1; 15935:277). */
export function ProcessFilters({ filter, onChange, operationClasses, facilityTypes, canCreate }: ProcessFiltersProps) {
  const classOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: t.allClasses },
    ...operationClasses.map((c) => ({ value: c.code, label: t.classOption(c.code, c.name) })),
  ]
  const facilityOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: t.allFacilities },
    ...facilityTypes.map((f) => ({ value: f.code, label: f.name })),
  ]

  return (
    <div className="flex flex-col gap-12">
      <div className="flex gap-12">
        <div className="flex-1">
          <Search label={t.search} value={filter.query} onChange={(e) => { onChange({ ...filter, query: e.target.value }) }} />
        </div>
        {canCreate && <MergedButtonLink to={ROUTE_PATHS.processNew} label={t.create} icon={Plus} />}
      </div>
      <div className="flex gap-8">
        <Select
          variant="filter"
          aria-label={t.filterClass}
          placeholder={t.filterClass}
          options={classOptions}
          value={filter.operationClass ?? ''}
          onChange={(v) => { onChange({ ...filter, operationClass: v === ALL ? null : (v as OperationClassCode) }) }}
        />
        <Select
          variant="filter"
          aria-label={t.filterFacility}
          placeholder={t.filterFacility}
          options={facilityOptions}
          value={filter.facilityType ?? ''}
          onChange={(v) => { onChange({ ...filter, facilityType: v === ALL ? null : (v as FacilityTypeCode) }) }}
        />
      </div>
    </div>
  )
}
