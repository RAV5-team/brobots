import type { FacilityTypeCode, LocationProcess, OperationClass, OperationClassCode, Process, ProcessCode } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { EMPTY_FILTER, filterProcesses, type FilterableProcess } from '@/pages/processes/processesModel'

const t = ru.location.templatePicker

export interface TemplateSources {
  readonly facilityType: FacilityTypeCode
  readonly processes: readonly Process[]
  readonly locationProcesses: readonly LocationProcess[]
  readonly operationClasses: readonly OperationClass[]
  readonly robotsByClass: Readonly<Partial<Record<OperationClassCode, number>>>
}

/** Строка окна 15а: шаблон справочника и можно ли привязать его копию к локации. */
export interface TemplateOption extends FilterableProcess {
  readonly code: ProcessCode
  /** «OP-03 Сортировка · 10 роботов»; у шаблона другого типа объекта — с пометкой (PRD 10.4, предложение). */
  readonly details: string
  /** Шаблон уже на локации: строка недоступна — один шаблон добавляется один раз (PRD 10.4). */
  readonly isOnLocation: boolean
  readonly isOtherFacilityType: boolean
}

type Group = 0 | 1 | 2

/** Сначала шаблоны своего типа объекта, затем чужого, в конце — уже добавленные; внутри группы — по коду. */
function group(option: TemplateOption): Group {
  if (option.isOnLocation) return 2
  return option.isOtherFacilityType ? 1 : 0
}

function classLabel(code: OperationClassCode, classes: readonly OperationClass[]): string {
  const name = classes.find((c) => c.code === code)?.name
  return name ? t.classLabel(code, name) : code
}

function robotsLabel(count: number): string {
  return count > 0 ? formatCount(count, ru.plural.robots) : t.noRobots
}

function toOption(process: Process, sources: TemplateSources, onLocation: ReadonlySet<ProcessCode>): TemplateOption {
  const isOnLocation = onLocation.has(process.code)
  const isOtherFacilityType = !process.facilityTypes.includes(sources.facilityType)
  const label = classLabel(process.operationClass, sources.operationClasses)
  // У добавленных число роботов не показываем — как в макете: строка лишь напоминает, что шаблон уже есть.
  const details = isOnLocation
    ? [label]
    : [label, robotsLabel(sources.robotsByClass[process.operationClass] ?? 0), ...(isOtherFacilityType ? [t.otherFacilityType] : [])]
  return {
    code: process.code,
    name: process.name,
    description: process.description,
    operationClass: process.operationClass,
    facilityTypes: process.facilityTypes,
    details: details.join(' · '),
    isOnLocation,
    isOtherFacilityType,
  }
}

/** Все шаблоны справочника для окна «Процесс из шаблона» (экран 15а). */
export function templateOptions(sources: TemplateSources): readonly TemplateOption[] {
  const onLocation = new Set(sources.locationProcesses.map((lp) => lp.processCode))
  return sources.processes
    .map((process) => toOption(process, sources, onLocation))
    .toSorted((a, b) => group(a) - group(b) || a.code.localeCompare(b.code))
}

/** Поиск по названию и описанию — то же правило, что у списка процессов 07. */
export function searchTemplates(options: readonly TemplateOption[], query: string): readonly TemplateOption[] {
  return filterProcesses(options, { ...EMPTY_FILTER, query })
}
