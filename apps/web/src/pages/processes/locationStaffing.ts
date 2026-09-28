import type { FacilityParameter, Location, LocationProcess, Process } from '@/domain'
import { STAFF_PARAMETERS } from './staffParameters'

/** Значение параметра на локации; нет переопределения — база датасета (как в фикстурах локаций). */
export function numberParameter(location: Location, parameters: readonly FacilityParameter[], code: string | null): number | null {
  if (code === null) return null
  const value = location.parameters[code]?.value ?? parameters.find((p) => p.code === code)?.base
  return typeof value === 'number' ? value : null
}

export interface Staffing {
  readonly role: string
  readonly headcount: number | null
  readonly salaryRub: number | null
  readonly timeShare: number
}

/** Кто выполняет процесс: группа из профиля локации, иначе — численность и оклад из датасета типа объекта. */
export function staffing(process: Process, lp: LocationProcess, location: Location, parameters: readonly FacilityParameter[]): Staffing | null {
  const worker = lp.workers[0]
  const role = worker?.role ?? process.defaultWorkerRole
  if (role === null) return null
  const timeShare = worker?.timeShare ?? 1
  const group = location.staffGroups.find((g) => g.role === role)
  if (group) return { role, headcount: group.headcount, salaryRub: group.salaryGrossMonthRub, timeShare }
  const fromDataset = STAFF_PARAMETERS[location.facilityType].find((g) => g.role === role)
  return {
    role,
    headcount: fromDataset ? numberParameter(location, parameters, fromDataset.headcount) : null,
    salaryRub: fromDataset ? numberParameter(location, parameters, fromDataset.salary) : null,
    timeShare,
  }
}
