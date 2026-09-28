import type {
  FacilityTypeCode,
  HandlingMethodCode,
  LocationProcess,
  LocationProcessUpdate,
  NewProcess,
  OperationClassCode,
  Process,
  ProcessCode,
  ProcessDefaults,
  ProcessHandling,
  ProcessTemplate,
  WorkCategoryCode,
} from '@/domain'
import { required, type ApiSchemas } from '../contract'

type TaskParams = ApiSchemas['TaskParams']

const FACILITIES: readonly FacilityTypeCode[] = ['warehouse', 'airport', 'medical']
const ROUTE_SEPARATOR = ' → '

/** Поля значений по умолчанию процесса ↔ параметры задачи API (одно имя — одно поле). */
const DEFAULT_FIELDS = {
  carrier: 'cargoUnit',
  unitMassKg: 'unitMassKg',
  cargoDivisible: 'cargoDivisible',
  dailyVolume: 'dailyVolume',
  workHoursPerDay: 'workHoursPerDay',
  peakFactor: 'peakFactor',
  routePoints: 'routePoints',
  automationShare: 'automationShare',
  routeLengthM: 'routeLengthM',
  minOperatingTempC: 'minOperatingTempC',
} as const satisfies Partial<Record<keyof ProcessDefaults, keyof TaskParams>>

/** Числовые поля формы процесса сверх значений по умолчанию ↔ параметры задачи API. */
const TEMPLATE_FIELDS = {
  peakFactor: 'peakFactor',
  speedLimitMps: 'siteSpeedLimitMps',
  widthMarginM: 'widthClearanceM',
  liftTripShare: 'liftTripShare',
  liftWaitS: 'liftTimeS',
  minAisleWidthM: 'minAisleWidthM',
  staffTurnoverShare: 'turnoverRate',
  workTimeLossShare: 'workTimeLoss',
  fleetOperatorsPerShift: 'fleetOperatorsPerShift',
  fleetOperatorSalaryRub: 'fleetOperatorSalaryRub',
  sitePreparationShare: 'sitePrepShare',
  itIntegrationRub: 'itIntegrationRub',
  consumablesRubPerYear: 'consumablesPerRobotRub',
  otherEffectsRubPerYear: 'otherEffectsRub',
} as const satisfies Partial<Record<keyof ProcessTemplate, keyof TaskParams>>

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

function defaultsOf(params: TaskParams | undefined): ProcessDefaults {
  const p = params ?? {}
  const out: Mutable<Partial<ProcessDefaults>> = {}
  if (p.cargoUnit) out.carrier = p.cargoUnit
  if (p.unitMassKg != null) out.unitMassKg = p.unitMassKg
  if (p.cargoDivisible != null) out.cargoDivisible = p.cargoDivisible
  if (p.peakFactor != null) out.peakFactor = p.peakFactor
  if (p.routePoints?.length) out.routePoints = p.routePoints
  if (p.routeLengthM != null) out.routeLengthM = p.routeLengthM
  if (p.minOperatingTempC != null) out.minOperatingTempC = p.minOperatingTempC
  return { ...out, dailyVolume: p.dailyVolume ?? 0, workHoursPerDay: p.workHoursPerDay ?? 0, automationShare: p.automationShare ?? 0 }
}

function templateOf(dto: ApiSchemas['Process']): ProcessTemplate {
  const p = dto.defaults ?? {}
  const facility = (dto.facilityTypes ?? []).find((f): f is FacilityTypeCode => (FACILITIES as readonly string[]).includes(f)) ?? 'warehouse'
  return {
    category: { facilityType: facility, workCategory: (dto.workCategoryCode ?? 'internal_logistics') as WorkCategoryCode },
    route: (p.routePoints ?? []).join(ROUTE_SEPARATOR),
    peakFactor: p.peakFactor ?? 1,
    speedLimitMps: p.siteSpeedLimitMps ?? 0,
    widthMarginM: p.widthClearanceM ?? 0,
    liftTripShare: p.liftTripShare ?? 0,
    liftWaitS: p.liftTimeS ?? 0,
    indoor: p.environment !== 'outdoor',
    minAisleWidthM: p.minAisleWidthM ?? 0,
    staff: dto.defaultWorkerRole ? [{ role: dto.defaultWorkerRole, timeShare: dto.defaultWorkerTimeShare ?? 1 }] : [],
    staffTurnoverShare: p.turnoverRate ?? 0,
    workTimeLossShare: p.workTimeLoss ?? 0,
    fleetOperatorsPerShift: p.fleetOperatorsPerShift ?? 0,
    fleetOperatorSalaryRub: p.fleetOperatorSalaryRub ?? 0,
    sitePreparationShare: p.sitePrepShare ?? 0,
    itIntegrationRub: p.itIntegrationRub ?? 0,
    consumablesRubPerYear: p.consumablesPerRobotRub ?? 0,
    otherEffectsRubPerYear: p.otherEffectsRub ?? 0,
  }
}

function handlingOf(list: readonly ApiSchemas['HandlingShare'][] | null | undefined): readonly ProcessHandling[] {
  return (list ?? []).filter((h) => h.code).map((h) => ({
    method: h.code as HandlingMethodCode,
    ...(h.laborReplacementRatio == null ? {} : { laborReplacementRatio: h.laborReplacementRatio }),
  }))
}

/** Процесс справочника API → шаблон процесса экрана (PRD 9). */
export function processFromApi(dto: ApiSchemas['Process']): Process {
  const entity = 'Process'
  return {
    code: required(dto, 'code', entity) as ProcessCode,
    name: required(dto, 'name', entity),
    description: dto.description ?? '',
    operationClass: (dto.workType?.code ?? '') as OperationClassCode,
    volumeUnit: dto.kpiUnit ?? dto.workType?.unitLabel ?? '',
    facilityTypes: (dto.facilityTypes ?? []).filter((f): f is FacilityTypeCode => (FACILITIES as readonly string[]).includes(f)),
    handling: handlingOf(dto.handlingMethods),
    defaultWorkerRole: dto.defaultWorkerRole ?? null,
    defaults: defaultsOf(dto.defaults),
    template: templateOf(dto),
  }
}

function paramsOf(defaults: Partial<ProcessDefaults>, template: Partial<ProcessTemplate> | undefined): TaskParams {
  const out: Record<string, unknown> = {}
  for (const [field, param] of Object.entries(DEFAULT_FIELDS)) {
    const value = defaults[field as keyof ProcessDefaults]
    if (value !== undefined) out[param] = value
  }
  for (const [field, param] of Object.entries(TEMPLATE_FIELDS)) {
    const value = template?.[field as keyof ProcessTemplate]
    if (value !== undefined) out[param] = value
  }
  if (template?.indoor !== undefined) out.environment = template.indoor ? 'indoor' : 'outdoor'
  if (template?.route && !defaults.routePoints) out.routePoints = template.route.split(ROUTE_SEPARATOR).filter(Boolean)
  return out
}

/** Новый процесс формы 09а → тело `POST /processes`. */
export function processInput(input: NewProcess, workTypeId: string): ApiSchemas['ProcessInput'] {
  const staff = input.template?.staff[0]
  return {
    name: input.name,
    description: input.description,
    workTypeId,
    kpiUnit: input.volumeUnit,
    facilityTypes: [...input.facilityTypes],
    handlingMethods: input.handling.map((h) => ({ code: h.method, laborReplacementRatio: h.laborReplacementRatio ?? null })),
    defaultWorkerRole: staff?.role ?? input.defaultWorkerRole,
    defaultWorkerTimeShare: staff?.timeShare ?? null,
    workCategoryCode: input.template?.category.workCategory ?? null,
    defaults: paramsOf(input.defaults, input.template),
    isCustom: true,
  }
}

const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b)

/**
 * Задача API → процесс на локации: копия шаблона (D-11). Переопределения — значения задачи, которые отличаются
 * от значений процесса справочника; одинаковые экран показывает как значения шаблона.
 */
export function locationProcessFromTask(dto: ApiSchemas['Task'], process: ApiSchemas['Process'] | undefined): LocationProcess {
  const entity = 'Task'
  const task = dto.params ?? {}
  const base = process?.defaults ?? {}
  const pick = (fields: Readonly<Record<string, keyof TaskParams>>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(fields).filter(([, param]) => task[param] != null && differs(task[param], base[param])).map(([field, param]) => [field, task[param]]))
  const templateOverrides: Record<string, unknown> = pick(TEMPLATE_FIELDS)
  if (task.environment && task.environment !== base.environment) templateOverrides.indoor = task.environment === 'indoor'
  const processName = dto.processName ?? process?.name ?? null
  const name = required(dto, 'name', entity)
  const handling = handlingOf(dto.handlingMethods)
  return {
    id: required(dto, 'id', entity),
    locationId: required(dto, 'locationId', entity),
    processCode: (process?.code ?? '') as ProcessCode,
    name: name === processName ? null : name,
    overrides: pick(DEFAULT_FIELDS),
    templateOverrides,
    handling: differs(handling, handlingOf(process?.handlingMethods)) ? handling : undefined,
    workers: (dto.workers ?? []).map((w) => ({ role: w.roleName ?? '', timeShare: w.timeShare ?? 0 })),
  }
}

/** Значения формы 16 → тело `PATCH /tasks/{id}`. */
export function taskPatch(update: LocationProcessUpdate, processName: string): ApiSchemas['TaskPatchInput'] {
  return {
    name: update.name ?? processName,
    params: paramsOf(update.overrides, update.templateOverrides),
    ...(update.handling ? { handlingMethods: update.handling.map((h) => ({ code: h.method, laborReplacementRatio: h.laborReplacementRatio ?? null })) } : {}),
    workers: update.workers.map((w) => ({ roleName: w.role, timeShare: w.timeShare })),
  }
}
