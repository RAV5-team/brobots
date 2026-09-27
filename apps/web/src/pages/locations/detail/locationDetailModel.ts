import type {
  FacilityParameter,
  FacilityType,
  Location,
  LocationProcess,
  LocationProcessId,
  LocationSummary,
  OperationClass,
  OperationClassCode,
  Process,
  Project,
} from '@/domain'
import { formatCount, formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { staffing } from '@/pages/processes/locationStaffing'
import { defaultRows, rateUnit, type DefaultRow, type FilterableProcess } from '@/pages/processes/processesModel'

const t = ru.location

/** Обязательных значений у процесса на локации: семь значений карточки, исполнители и оклад (PRD 10.4). */
export const REQUIRED_VALUES = 9

/** Чего может не хватать процессу: значения шаблона заданы всегда, кроме объёма, который бывает пустым на площадке. */
export type MissingItem = keyof typeof t.card.missingItems

export interface LocationDetailData {
  readonly location: Location
  /** Сводка из `GET /locations`; нет — строка профиля без площади, персонала и смен. */
  readonly summary: LocationSummary | undefined
  readonly facilityTypeName: string
  readonly facilityTypes: readonly FacilityType[]
  /** Шаблоны справочника: из них берутся описание, класс и значения по умолчанию. */
  readonly processes: readonly Process[]
  readonly locationProcesses: readonly LocationProcess[]
  readonly operationClasses: readonly OperationClass[]
  /** Роботы каталога с классом процесса — совпадение по классу, не результат подбора (PRD 3.4). */
  readonly robotsByClass: Readonly<Partial<Record<OperationClassCode, number>>>
  readonly projects: readonly Project[]
  /** Параметры типа объекта локации — база датасета для численности и окладов. */
  readonly parameters: readonly FacilityParameter[]
}

/** Карточка вкладки «Процессы локации»: копия шаблона со значениями площадки. */
export interface LocationProcessView extends FilterableProcess {
  readonly id: LocationProcessId
  readonly unit: string
  readonly classLabel: string
  readonly rows: readonly DefaultRow[]
  readonly robotCount: number
  /** Входит в расчёт хотя бы одного проекта этой локации — плашка «✓ Выбран». */
  readonly isSelected: boolean
  readonly missing: readonly MissingItem[]
}

/** «Москва · 20 000 м² · 180 сотрудников · 2 смены × 11 ч»; неизвестные значения пропускаются. */
export function profileLine(location: Location, summary: LocationSummary | undefined): string {
  const shifts = summary?.shiftsPerDay != null && summary.shiftHours != null
    ? t.shifts(formatCount(summary.shiftsPerDay, ru.plural.shifts), formatNumber(summary.shiftHours))
    : null
  return [
    location.city,
    summary?.totalAreaM2 == null ? null : ru.locations.card.areaValue(formatNumber(summary.totalAreaM2)),
    summary?.staffTotal == null ? null : formatCount(summary.staffTotal, ru.plural.employees),
    shifts,
  ].filter((part): part is string => part !== null).join(' · ')
}

/** Чего не хватает до расчёта: нет исполнителей — нет и оклада (уборка, инвентаризация; PRD 10.4). */
function missingValues(process: Process, lp: LocationProcess, data: LocationDetailData): readonly MissingItem[] {
  const volume = lp.overrides.dailyVolume ?? process.defaults.dailyVolume
  const staff = staffing(process, lp, data.location, data.parameters)
  const missing: readonly (MissingItem | null)[] = [
    volume > 0 ? null : 'volume',
    staff?.headcount == null ? 'workers' : null,
    staff?.salaryRub == null ? 'salary' : null,
  ]
  return missing.filter((item): item is MissingItem => item !== null)
}

/** Карточки процессов площадки в порядке добавления; процесс без шаблона в справочнике не показывается. */
export function locationProcessViews(data: LocationDetailData): readonly LocationProcessView[] {
  return data.locationProcesses.flatMap((lp) => {
    const process = data.processes.find((p) => p.code === lp.processCode)
    if (!process) return []
    const onLocation: Process = { ...process, defaults: { ...process.defaults, ...lp.overrides } }
    const operationClass = data.operationClasses.find((c) => c.code === process.operationClass)
    return [{
      id: lp.id,
      name: lp.name ?? process.name,
      description: process.description,
      operationClass: process.operationClass,
      facilityTypes: process.facilityTypes,
      unit: rateUnit(process),
      classLabel: ru.processes.classOption(process.operationClass, operationClass?.name ?? ''),
      rows: defaultRows(onLocation),
      robotCount: data.robotsByClass[process.operationClass] ?? 0,
      isSelected: data.projects.some((project) => project.processIds.includes(lp.id)),
      missing: missingValues(process, lp, data),
    }]
  })
}

/** «Готово к расчёту · 9/9» или «Не хватает 2: исполнители, оклад». */
export function readinessLabel(missing: readonly MissingItem[]): string {
  if (missing.length === 0) return t.card.ready(REQUIRED_VALUES)
  return t.card.missing(missing.length, missing.map((item) => t.card.missingItems[item]).join(', '))
}
