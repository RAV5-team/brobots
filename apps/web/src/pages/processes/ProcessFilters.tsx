import type { ReactNode } from 'react'
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
  /** Главное действие справа от поиска: «Создать новый процесс +»; null — действия нет (гость). */
  readonly action: ReactNode
  /** stacked — поиск над фильтрами (07, 15935:277); row — всё в одну строку (15, 15950:2521). */
  readonly layout?: 'stacked' | 'row'
}

/** Поиск, главное действие и два фильтра (PRD 9.1, 10.4). */
export function ProcessFilters({ filter, onChange, operationClasses, facilityTypes, action, layout = 'stacked' }: ProcessFiltersProps) {
  const classOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: t.allClasses },
    ...operationClasses.map((c) => ({ value: c.code, label: t.classOption(c.code, c.name) })),
  ]
  const facilityOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: t.allFacilities },
    ...facilityTypes.map((f) => ({ value: f.code, label: f.name })),
  ]

  const search = (
    <div className="flex-1">
      <Search label={t.search} value={filter.query} onChange={(e) => { onChange({ ...filter, query: e.target.value }) }} />
    </div>
  )
  const selects = (
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
  )

  if (layout === 'row') {
    return (
      <div className="flex items-center gap-8">
        {search}
        {selects}
        {action}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-12">
      <div className="flex gap-12">
        {search}
        {action}
      </div>
      {selects}
    </div>
  )
}
