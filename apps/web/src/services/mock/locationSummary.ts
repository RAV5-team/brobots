import type {
  FacilityParameter, FacilityTypeCode, Location, LocationLaborCost, LocationProcess, LocationSummary, Project,
} from '@/domain'
import type { LocationSummaryInputs } from '@/mocks/fixtures/locationSummaries'

/** Часов в сутках: у медучреждения задано только число смен, длина смены — сутки поровну («3 смены по 8 ч», датасет). */
const HOURS_PER_DAY = 24

/**
 * Какие параметры датасета дают метрики карточки. В services/api это роли параметров (`total_area`, `staff_total`…);
 * у аэропорта и медучреждения общей численности нет — складываем группы персонала (320 + 180, 65 + 28 + 18).
 */
const SUMMARY_PARAMETERS: Record<FacilityTypeCode, {
  readonly area: string
  readonly staff: readonly string[]
  readonly shifts: string | null
  readonly shiftHours: string | null
}> = {
  warehouse: { area: 'wh_total_area', staff: ['wh_staff_total'], shifts: 'wh_shifts', shiftHours: 'wh_shift_hours' },
  airport: { area: 'ap_terminal_area', staff: ['ap_ramp_staff', 'ap_terminal_staff'], shifts: null, shiftHours: null },
  medical: { area: 'med_total_area', staff: ['med_orderlies', 'med_kitchen_staff', 'med_laundry_staff'], shifts: 'med_shifts', shiftHours: null },
}

function numeric(location: Location, code: string | null): number | null {
  if (code === null) return null
  const value = location.parameters[code]?.value
  return typeof value === 'number' ? value : null
}

function sumOf(values: readonly (number | null)[]): number | null {
  return values.some((v) => v === null) ? null : values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function schedule(location: Location, inputs: LocationSummaryInputs | undefined) {
  if (inputs?.schedule) return inputs.schedule
  const codes = SUMMARY_PARAMETERS[location.facilityType]
  const shiftsPerDay = numeric(location, codes.shifts)
  const explicitHours = numeric(location, codes.shiftHours)
  const shiftHours = explicitHours ?? (shiftsPerDay ? HOURS_PER_DAY / shiftsPerDay : null)
  return { shiftsPerDay, shiftHours }
}

interface SummarySources {
  readonly processes: readonly LocationProcess[]
  readonly projects: readonly Project[]
  readonly laborCosts: readonly LocationLaborCost[]
  readonly inputs: readonly LocationSummaryInputs[]
  readonly parameters: readonly FacilityParameter[]
}

const PERCENT = 100

/** Полнота новой локации — доля заполненных параметров её типа объекта; у демо-локаций она задана в PRD 10.1. */
function completenessPct(location: Location, parameters: readonly FacilityParameter[]): number {
  const own = parameters.filter((p) => p.facilityType === location.facilityType)
  if (own.length === 0) return 0
  const filled = own.filter((p) => location.parameters[p.code] !== undefined).length
  return Math.round((filled / own.length) * PERCENT)
}

/**
 * Сводка карточки локации (PRD 10.1), как её считает services/api (`LocationSummary`):
 * допущения — параметры с источником «допущение» (PRD 15 · №45), процессы и проекты — по фикстурам (№41, №57),
 * «завершён» — сохранённая оценка. Ручной труд, занятость и полнота демо-локаций — готовыми, пока нет экономической модели;
 * у новой локации (12а) труда и занятости нет, полнота — по заполненным параметрам.
 */
export function buildLocationSummary(location: Location, sources: SummarySources): LocationSummary {
  const codes = SUMMARY_PARAMETERS[location.facilityType]
  const inputs = sources.inputs.find((i) => i.locationId === location.id)
  const projects = sources.projects.filter((p) => p.locationId === location.id)
  return {
    locationId: location.id,
    totalAreaM2: numeric(location, codes.area),
    staffTotal: sumOf(codes.staff.map((code) => numeric(location, code))),
    ...schedule(location, inputs),
    processesCount: sources.processes.filter((lp) => lp.locationId === location.id).length,
    laborCostRubYear: sources.laborCosts.find((c) => c.locationId === location.id)?.annualRub ?? null,
    workersInProcesses: inputs?.workersInProcesses ?? null,
    parametersCompletenessPct: inputs?.parametersCompletenessPct ?? completenessPct(location, sources.parameters),
    assumptionsCount: Object.values(location.parameters).filter((p) => p.source === 'assumption').length,
    projectsCount: projects.length,
    projectsCompleted: projects.filter((p) => p.status === 'saved').length,
  }
}
