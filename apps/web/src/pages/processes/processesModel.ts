import type { FacilityTypeCode, OperationClassCode, Process } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.processes

export interface ProcessFilter {
  readonly query: string
  readonly operationClass: OperationClassCode | null
  readonly facilityType: FacilityTypeCode | null
}

export const EMPTY_FILTER: ProcessFilter = { query: '', operationClass: null, facilityType: null }

/** Поиск без учёта регистра и различия «е» / «ё». */
function normalize(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()
}

/** Что нужно фильтру: процесс библиотеки или процесс на локации со своим названием. */
export type FilterableProcess = Pick<Process, 'name' | 'description' | 'operationClass' | 'facilityTypes'>

/** Поиск — по названию и описанию (PRD 9.1); фильтры — по классу операции и типу объекта. */
export function filterProcesses<T extends FilterableProcess>(processes: readonly T[], filter: ProcessFilter): readonly T[] {
  const query = normalize(filter.query)
  return processes.filter((p) =>
    (filter.operationClass === null || p.operationClass === filter.operationClass) &&
    (filter.facilityType === null || p.facilityTypes.includes(filter.facilityType)) &&
    (query === '' || normalize(`${p.name} ${p.description}`).includes(query)),
  )
}

export function isFilterActive(filter: ProcessFilter): boolean {
  return filter.query.trim() !== '' || filter.operationClass !== null || filter.facilityType !== null
}

/** «паллет / ч»; у обходов охраны — «обходов / сут» (PRD 9.1). */
export function rateUnit(process: Process): string {
  return t.card.rate(process.volumeUnit, process.ratePeriod ?? 'hour')
}

export interface DefaultRow {
  readonly key: keyof typeof t.defaults
  readonly label: string
  readonly value: string
}

const optional = (value: number | undefined, format: (v: string) => string): string =>
  value === undefined ? t.card.none : format(formatNumber(value))

/** Семь строк «Значения по умолчанию» (PRD 9.1). Нет груза — масса и делимость прочерком. */
export function defaultRows(process: Process): readonly DefaultRow[] {
  const d = process.defaults
  const values: Record<DefaultRow['key'], string> = {
    volume: t.card.volume(formatNumber(d.dailyVolume), process.volumeUnit, process.volumePeriod ?? 'day'),
    hours: t.card.hours(formatNumber(d.workHoursPerDay)),
    route: optional(d.routeLengthM, t.card.meters),
    automation: formatPercent(d.automationShare),
    mass: optional(d.unitMassKg, t.card.kilograms),
    divisible: d.cargoDivisible === undefined ? t.card.none : d.cargoDivisible ? t.card.yes : t.card.no,
    carrier: d.carrier ?? t.card.none,
  }
  return (Object.keys(t.defaults) as DefaultRow['key'][]).map((key) => ({ key, label: t.defaults[key], value: values[key] }))
}
