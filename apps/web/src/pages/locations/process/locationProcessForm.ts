// Форма 16 «Процесс на локации»: копия шаблона со значениями площадки (PRD 10.4, D-11).
// Значения собираются слоями: шаблон справочника → формулы профиля локации → переопределения копии.
// Сохраняются только переопределения: остальное по-прежнему берётся из шаблона и профиля.
import type {
  FacilityParameter,
  Location,
  LocationProcess,
  LocationProcessUpdate,
  ProcessTemplateDefaults,
  OperationClass,
  Process,
  ProcessDefaults,
  ProcessHandling,
  ProcessTemplate,
} from '@/domain'
import { numberParameter } from '@/pages/processes/locationStaffing'
import { toNewProcess } from '@/pages/processes/new/processCalc'
import { categoryValue, parseDecimal, type NumericKey, type ProcessForm, type StaffRow } from '@/pages/processes/new/processForm'
import { warehouseBase, type WarehouseBase } from '@/pages/processes/new/processDemoForm'
import { numericHints } from '@/pages/processes/new/processNewModel'
import { STAFF_PARAMETERS } from '@/pages/processes/staffParameters'
import { formatNumber } from '@/shared/format'

const PERCENT = 100
const RATIO_FORMAT = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Значения процесса, из которых собирается форма: шаблон, шаблон с профилем или копия на локации. */
export interface ProcessValues {
  readonly name: string
  readonly handling: readonly ProcessHandling[]
  readonly defaults: ProcessDefaults
  readonly template: ProcessTemplate
  /** Группы исполнителей и доля их времени. */
  readonly workers: readonly { readonly role: string; readonly timeShare: number }[]
}

/** Параметры типа объекта со значениями этой локации вместо базы датасета. */
function siteParameters(location: Location, parameters: readonly FacilityParameter[]): readonly FacilityParameter[] {
  return parameters.map((p) => {
    const value = location.parameters[p.code]?.value
    return value === undefined ? p : { ...p, base: value }
  })
}

/** База формул профиля: пока есть только у склада — датасеты аэропорта и медучреждения устроены иначе. */
export function siteBase(location: Location, parameters: readonly FacilityParameter[]): WarehouseBase | null {
  return location.facilityType === 'warehouse' ? warehouseBase(siteParameters(location, parameters)) : null
}

/** Группы из профиля локации; нет своих — группы датасета типа объекта с численностью и окладом площадки. */
function profileGroups(location: Location, parameters: readonly FacilityParameter[]) {
  if (location.staffGroups.length > 0) return location.staffGroups.map((g) => ({ role: g.role, headcount: g.headcount, salaryRub: g.salaryGrossMonthRub }))
  return STAFF_PARAMETERS[location.facilityType].map((g) => ({
    role: g.role,
    headcount: numberParameter(location, parameters, g.headcount) ?? 0,
    salaryRub: numberParameter(location, parameters, g.salary),
  }))
}

/** Точки маршрута одной фразой, как в макете: «Приёмка → зона хранения → отгрузка». */
function routeText(points: readonly string[]): string {
  return points.map((point, i) => (i === 0 ? point : point.charAt(0).toLocaleLowerCase('ru-RU') + point.slice(1))).join(' → ')
}

/** Поля шаблона, которых у процессов из источника пока нет, — значения по умолчанию формы 09а (PRD 15 · №22). */
function templateOf(process: Process, location: Location, cls: OperationClass | undefined, defaults: ProcessTemplateDefaults): ProcessTemplate {
  if (process.template) return process.template
  const d = process.defaults
  return {
    category: { facilityType: location.facilityType, workCategory: cls?.workCategory ?? 'internal_logistics' },
    route: routeText(d.routePoints ?? []),
    peakFactor: d.peakFactor ?? 1,
    speedLimitMps: defaults.speedLimitMps,
    widthMarginM: defaults.widthMarginM,
    liftTripShare: defaults.liftTripPct / PERCENT,
    liftWaitS: defaults.liftWaitS,
    indoor: true,
    minAisleWidthM: 0,
    staff: process.defaultWorkerRole === null ? [] : [{ role: process.defaultWorkerRole, timeShare: 1 }],
    staffTurnoverShare: defaults.turnoverPct / PERCENT,
    workTimeLossShare: 0,
    fleetOperatorsPerShift: defaults.fleetOperators,
    fleetOperatorSalaryRub: 0,
    sitePreparationShare: defaults.sitePrepPct / PERCENT,
    itIntegrationRub: defaults.itIntegrationRub,
    consumablesRubPerYear: defaults.consumablesRub,
    otherEffectsRubPerYear: defaults.otherEffectsRub,
  }
}

interface SiteContext {
  /** Значения по умолчанию формы 09а из сервиса процессов (PRD 15 · №22). */
  readonly defaults: ProcessTemplateDefaults
  readonly process: Process
  readonly operationClass: OperationClass | undefined
  readonly location: Location
  readonly parameters: readonly FacilityParameter[]
}

/**
 * Шаблон на этой локации — «значения уже взяты из профиля по формулам процесса» (PRD 10.4):
 * часы = смены × часы смены, пик и потери времени — из профиля, проход — «Параметры объекта», оклад оператора флота — оклад первой группы.
 */
export function siteValues({ defaults, process, operationClass, location, parameters }: SiteContext): ProcessValues {
  const template = templateOf(process, location, operationClass, defaults)
  const base = siteBase(location, parameters)
  const firstRole = template.staff[0]?.role
  const salary = profileGroups(location, parameters).find((g) => g.role === firstRole)?.salaryRub
  return {
    name: process.name,
    handling: process.handling,
    defaults: {
      ...process.defaults,
      ...(base && { workHoursPerDay: base.shifts * base.shiftHours, peakFactor: base.peakFactor }),
    },
    template: {
      ...template,
      category: { ...template.category, facilityType: location.facilityType },
      ...(base && { peakFactor: base.peakFactor, minAisleWidthM: base.rackAisle, workTimeLossShare: base.workTimeLossPct / PERCENT }),
      ...(salary != null && { fleetOperatorSalaryRub: salary }),
    },
    workers: template.staff,
  }
}

/** Копия на локации: переопределения поверх шаблона с профилем. */
export function copyValues(site: ProcessValues, lp: LocationProcess): ProcessValues {
  return {
    name: lp.name ?? site.name,
    handling: lp.handling ?? site.handling,
    defaults: { ...site.defaults, ...lp.overrides },
    template: { ...site.template, ...lp.templateOverrides },
    workers: lp.workers.length > 0 ? lp.workers : site.workers,
  }
}

const text = (value: number): string => formatNumber(value, 1)
const percent = (share: number): string => text(share * PERCENT)
const capitalize = (value: string): string => value.charAt(0).toLocaleUpperCase('ru-RU') + value.slice(1)

function staffRows(values: ProcessValues, location: Location, parameters: readonly FacilityParameter[]): readonly StaffRow[] {
  return profileGroups(location, parameters).map((group) => {
    const worker = values.workers.find((w) => w.role === group.role)
    return { ...group, selected: worker !== undefined, timeSharePct: worker ? percent(worker.timeShare) : '' }
  })
}

/** Значения → поля формы; строки таблицы исполнителей — группы профиля локации. */
export function formOf(values: ProcessValues, ctx: Omit<SiteContext, 'operationClass'>): ProcessForm {
  const { defaults: d, template: tpl } = values
  const ratios = Object.fromEntries(values.handling.flatMap((h) => (h.laborReplacementRatio === undefined ? [] : [[h.method, h.laborReplacementRatio]])))
  const replacement = { ...ctx.defaults.replacement, ...ratios }
  return {
    operationClass: ctx.process.operationClass,
    name: values.name,
    category: categoryValue(tpl.category.facilityType, tpl.category.workCategory),
    carrier: capitalize(d.carrier ?? ''),
    cargoDivisible: d.cargoDivisible ?? false,
    route: tpl.route,
    handling: values.handling.map((h) => h.method),
    indoor: tpl.indoor,
    unitMassKg: d.unitMassKg === undefined ? '' : text(d.unitMassKg),
    dailyVolume: text(d.dailyVolume),
    workHours: text(d.workHoursPerDay),
    peakFactor: text(tpl.peakFactor),
    automationPct: percent(d.automationShare),
    routeLengthM: d.routeLengthM === undefined ? '' : text(d.routeLengthM),
    speedLimitMps: text(tpl.speedLimitMps),
    widthMarginM: text(tpl.widthMarginM),
    liftTripPct: percent(tpl.liftTripShare),
    liftWaitS: text(tpl.liftWaitS),
    minAisleWidthM: text(tpl.minAisleWidthM),
    minTempC: d.minOperatingTempC === undefined ? '' : text(d.minOperatingTempC),
    staff: staffRows(values, ctx.location, ctx.parameters),
    replacement: Object.fromEntries(Object.entries(replacement).map(([method, ratio]) => [method, RATIO_FORMAT.format(ratio)])),
    turnoverPct: percent(tpl.staffTurnoverShare),
    workTimeLossPct: percent(tpl.workTimeLossShare),
    fleetOperators: text(tpl.fleetOperatorsPerShift),
    fleetSalaryRub: text(tpl.fleetOperatorSalaryRub),
    sitePrepPct: percent(tpl.sitePreparationShare),
    itIntegrationRub: text(tpl.itIntegrationRub),
    consumablesRub: text(tpl.consumablesRubPerYear),
    otherEffectsRub: text(tpl.otherEffectsRubPerYear),
  }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Ключи, значения которых на форме отличаются от шаблона с профилем. */
function changedKeys<T extends object>(value: T, base: T): Partial<T> {
  const keys = new Set([...Object.keys(value), ...Object.keys(base)]) as Set<keyof T>
  return Object.fromEntries([...keys].filter((k) => !same(value[k], base[k])).map((k) => [k, value[k]])) as Partial<T>
}

/** Поля шаблона без исполнителей: их копия хранит отдельно, в `workers`. */
function withoutStaff(template: ProcessTemplate): Omit<ProcessTemplate, 'staff'> {
  return Object.fromEntries(Object.entries(template).filter(([key]) => key !== 'staff')) as Omit<ProcessTemplate, 'staff'>
}

/**
 * Форма → значения копии для `updateLocationProcess`. Сохраняются только отличия от шаблона с профилем:
 * неизменённые значения и дальше следуют за профилем локации. Класс не входит — он наследуется из шаблона.
 */
export function toLocationUpdate(form: ProcessForm, siteForm: ProcessForm, process: Process): LocationProcessUpdate {
  const next = toNewProcess(form, process.volumeUnit, process.description)
  const site = toNewProcess(siteForm, process.volumeUnit, process.description)
  // toNewProcess всегда собирает template; исполнители сохраняются отдельно — в workers.
  const template = withoutStaff(next.template as ProcessTemplate)
  const siteTemplate = withoutStaff(site.template as ProcessTemplate)
  const name = form.name.trim()
  return {
    name: name === process.name ? null : name,
    overrides: changedKeys(next.defaults, site.defaults),
    templateOverrides: changedKeys(template, siteTemplate),
    handling: same(next.handling, site.handling) ? undefined : next.handling,
    workers: (next.template as ProcessTemplate).staff,
  }
}

/** Сколько полей формы отличаются от шаблона с профилем — строка «Изменено на локации» панели. */
export function countChanged(form: ProcessForm, siteForm: ProcessForm): number {
  const staffChanged = form.staff.some((row, i) => {
    const base = siteForm.staff[i]
    return row.selected !== base?.selected || (row.selected && parseDecimal(row.timeSharePct) !== parseDecimal(base.timeSharePct))
  })
  const fields = (Object.keys(form) as (keyof ProcessForm)[]).filter((k) => k !== 'staff' && k !== 'replacement' && !same(normalized(form, k), normalized(siteForm, k)))
  const methods = form.handling.filter((m) => parseDecimal(form.replacement[m] ?? '') !== parseDecimal(siteForm.replacement[m] ?? ''))
  return fields.length + methods.length + (staffChanged ? 1 : 0)
}

/** Число «2 000» и «2000» — одно значение; строки сравниваются без пробелов по краям. */
function normalized(form: ProcessForm, key: keyof ProcessForm): unknown {
  const value = form[key]
  if (typeof value !== 'string') return value
  return parseDecimal(value) ?? value.trim()
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * Подсказки-формулы площадки — те же, что на 09а, но на профиле локации. Формулу показываем, только если значение поля
 * шаблона с профилем из неё и получено: у «Комплектации» объём не «приёмка + отгрузка паллет» (PRD 10.4).
 */
export function siteHints(base: WarehouseBase | null, siteForm: ProcessForm): Readonly<Partial<Record<NumericKey, string>>> {
  if (base === null) return {}
  const firstGroup = siteForm.staff.find((row) => row.selected)
  const oneFloor = base.floors === 1 ? 0 : Number.NaN
  const derived: Readonly<Partial<Record<NumericKey, number>>> = {
    dailyVolume: base.inbound + base.outbound,
    workHours: base.shifts * base.shiftHours,
    automationPct: (1 - base.oversizeShare) * PERCENT,
    routeLengthM: Math.sqrt(base.activeArea),
    liftTripPct: oneFloor,
    liftWaitS: oneFloor,
    minAisleWidthM: base.rackAisle,
    fleetSalaryRub: firstGroup?.salaryRub ?? Number.NaN,
  }
  const all = numericHints(base, siteForm)
  return Object.fromEntries(
    (Object.keys(derived) as NumericKey[]).flatMap((key) => {
      const value = parseDecimal(siteForm[key])
      const formula = derived[key]
      const hint = all[key]
      return hint !== undefined && value !== null && formula !== undefined && round1(formula) === value ? [[key, hint]] : []
    }),
  )
}
