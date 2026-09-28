import type {
  FacilityParameter,
  FacilityType,
  FacilityTypeCode,
  Location,
  LocationSummary,
  NewLocation,
  ParameterValue,
  ValueSource,
} from '@/domain'
import { oneOf, optional, required, type ApiSchemas } from '../contract'

const FACILITIES: readonly FacilityTypeCode[] = ['warehouse', 'airport', 'medical']
const RUB = 'RUB'

/** Источник значения API (ValueSources) → статус значения экрана. */
function sourceOf(dto: ApiSchemas['ParameterValue']): ValueSource {
  if (dto.isAssumption || dto.source === 'assumption') return 'assumption'
  switch (dto.source) {
    case 'user':
    case 'file':
      return 'user'
    case 'formula':
      return 'computed'
    default:
      return 'organizer'
  }
}

const SOURCE_CODE: Readonly<Record<ValueSource, string>> = { organizer: 'organizer', user: 'user', assumption: 'assumption', computed: 'formula' }

function valueOf(value: unknown): number | string {
  if (typeof value === 'number' || typeof value === 'string') return value
  return typeof value === 'boolean' ? String(value) : JSON.stringify(value ?? '')
}

/** Значения параметров API (`GET /locations/{id}/parameters`) → параметры локации по кодам. */
export function parametersFromApi(dto: ApiSchemas['LocationParameters']): Readonly<Record<string, ParameterValue>> {
  const entries = (dto.groups ?? []).flatMap((g) => g.items ?? []).filter((item) => item.value?.code && item.value.value != null)
  return Object.fromEntries(entries.map((item) => {
    const value = required(item, 'value', 'ParameterItem')
    return [required(value, 'code', 'ParameterValue'), { value: valueOf(value.value), source: sourceOf(value) }]
  }))
}

/** Локация API (+ параметры) → локация экрана. Параметров в списке нет — их приносит `GET /locations/{id}/parameters`. */
export function locationFromApi(dto: ApiSchemas['Location'], parameters: Readonly<Record<string, ParameterValue>> = {}): Location {
  const entity = 'Location'
  return {
    id: required(dto, 'id', entity),
    name: required(dto, 'name', entity),
    facilityType: oneOf(required(dto, 'facilityTypeCode', entity), FACILITIES, `${entity}.facilityTypeCode`),
    city: dto.city ?? '',
    address: dto.address ?? '',
    capexBudgetRub: dto.capexBudget?.amount ?? 0,
    horizonYears: dto.horizonYears ?? 0,
    parameters,
    staffGroups: (dto.staffGroups ?? []).map((g) => ({ role: g.roleName ?? '', headcount: g.headcount ?? 0, salaryGrossMonthRub: optional(g.salaryGrossMonthRub) })),
    updatedAt: required(dto, 'updatedAt', entity),
  }
}

/** Сводка карточки списка (PRD 10.1) — `summary` у `GET /locations`. */
export function summaryFromApi(dto: ApiSchemas['Location']): LocationSummary {
  const s = dto.summary ?? {}
  return {
    locationId: required(dto, 'id', 'Location'),
    totalAreaM2: optional(s.totalAreaM2),
    staffTotal: optional(s.staffTotal),
    shiftsPerDay: optional(s.shiftsPerDay),
    shiftHours: optional(s.shiftHours),
    processesCount: s.tasksCount ?? 0,
    laborCostRubYear: optional(s.laborCostRubYear),
    workersInProcesses: optional(s.workersInTasks),
    parametersCompletenessPct: s.parametersCompletenessPct ?? 0,
    assumptionsCount: s.assumptionsCount ?? 0,
    projectsCount: s.projectsCount ?? 0,
    projectsCompleted: s.projectsCompleted ?? 0,
  }
}

export function parameterInputs(parameters: NewLocation['parameters']): ApiSchemas['ParameterInput'][] {
  return Object.entries(parameters).map(([code, p]) => ({
    code, value: p.value, source: SOURCE_CODE[p.source], isAssumption: p.source === 'assumption',
  }))
}

export function staffInputs(groups: NewLocation['staffGroups']): ApiSchemas['StaffGroupInput'][] {
  return groups.map((g) => ({ roleName: g.role, headcount: g.headcount, salaryGrossMonthRub: g.salaryGrossMonthRub }))
}

/** Локация формы 14 → тело `POST /locations`. */
export function locationInput(input: NewLocation): ApiSchemas['LocationInput'] {
  return {
    name: input.name,
    facilityTypeCode: input.facilityType,
    city: input.city,
    address: input.address,
    capexBudget: { amount: input.capexBudgetRub, currency: RUB },
    horizonYears: input.horizonYears,
    parameters: parameterInputs(input.parameters),
    staffGroups: staffInputs(input.staffGroups),
  }
}

export function facilityTypeFromOption(dto: ApiSchemas['Option']): FacilityType | null {
  return dto.code && (FACILITIES as readonly string[]).includes(dto.code) ? { code: dto.code as FacilityTypeCode, name: dto.name ?? dto.code } : null
}

/** Параметр датасета API → параметр типа объекта экрана (приложение А PRD). */
export function facilityParameterFromApi(dto: ApiSchemas['ParameterDefinition']): FacilityParameter {
  const entity = 'ParameterDefinition'
  return {
    code: required(dto, 'code', entity),
    facilityType: oneOf(required(dto, 'facilityTypeCode', entity), FACILITIES, `${entity}.facilityTypeCode`),
    group: dto.groupName ?? '',
    name: required(dto, 'name', entity),
    unit: dto.unit ?? '',
    base: dto.baseValueNumber ?? dto.baseValueText ?? '',
    min: optional(dto.minValue),
    max: optional(dto.maxValue),
    note: dto.hint ?? dto.sourceNote ?? '',
  }
}
