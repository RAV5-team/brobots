import type { NewProcess, ProcessTemplate } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  NUMERIC_SPECS,
  parseCategory,
  parseDecimal,
  replaceableMethods,
  type NumericKey,
  type ProcessForm,
  type StaffRow,
} from './processForm'

const t = ru.processNew
const MONTHS_PER_YEAR = 12
const PERCENT = 100

const num = (form: ProcessForm, key: NumericKey): number | null => parseDecimal(form[key])
const share = (form: ProcessForm, key: NumericKey): number | null => {
  const value = num(form, key)
  return value === null ? null : value / PERCENT
}

export interface VolumeRates {
  /** Пиковая интенсивность, оп./ч = объём ÷ часы × пик. */
  readonly peak: number
  /** К роботизации в пик, рейсов/ч = пиковая × доля автоматизируемых — главное число подбора (PRD 11.2). */
  readonly toRobots: number
  /** Среднечасовая, оп./ч = объём × доля ÷ часы. */
  readonly average: number
}

/** Секция 2: считается на неокруглённых значениях, округление — только при показе (D-19, PRD 15 · №36). */
export function volumeRates(form: ProcessForm): VolumeRates | null {
  const volume = num(form, 'dailyVolume')
  const hours = num(form, 'workHours')
  const peakFactor = num(form, 'peakFactor')
  const automation = share(form, 'automationPct')
  if (volume === null || hours === null || hours <= 0 || peakFactor === null || automation === null) return null
  const peak = (volume / hours) * peakFactor
  return { peak, toRobots: peak * automation, average: (volume * automation) / hours }
}

export interface StaffTotals {
  readonly fte: number
  /** ФОТ базы процесса, ₽/год = Σ численность × оклад × 12 × начисления. */
  readonly baseFot: number
  /** ФОТ целевых FTE, ₽/год. */
  readonly targetFot: number
  /** Выбранные группы с окладом и долей — из них посчитаны итоги. */
  readonly rows: readonly (StaffRow & { readonly salaryRub: number; readonly share: number })[]
}

/** Секция 4: целевые FTE = Σ численность × доля времени × доля автоматизируемых (PRD 9.2). */
export function staffTotals(form: ProcessForm, payrollCoef: number): StaffTotals | null {
  const automation = share(form, 'automationPct')
  if (automation === null) return null
  const rows = form.staff.flatMap((row) => {
    const rowShare = parseDecimal(row.timeSharePct)
    if (!row.selected || row.salaryRub === null || rowShare === null) return []
    return [{ ...row, salaryRub: row.salaryRub, share: rowShare / PERCENT }]
  })
  if (rows.length === 0) return null
  const yearly = (people: number, salary: number) => people * salary * MONTHS_PER_YEAR * payrollCoef
  return {
    fte: rows.reduce((sum, r) => sum + r.headcount * r.share * automation, 0),
    baseFot: rows.reduce((sum, r) => sum + yearly(r.headcount, r.salaryRub), 0),
    targetFot: rows.reduce((sum, r) => sum + yearly(r.headcount * r.share * automation, r.salaryRub), 0),
    rows,
  }
}

export type FormErrors = Readonly<Record<string, string>>

function numericError(form: ProcessForm, key: NumericKey): string | null {
  const spec = NUMERIC_SPECS[key]
  const raw = form[key].trim()
  if (raw === '') return spec.required === true ? t.errors.required : null
  const value = parseDecimal(raw)
  if (value === null) return t.errors.number
  if (value < spec.min || value > spec.max) return t.errors.range(formatNumber(spec.min, 1), formatNumber(spec.max, 1))
  return null
}

function staffErrors(form: ProcessForm): Record<string, string> {
  const selected = form.staff.filter((row) => row.selected)
  if (selected.length === 0) return { staff: t.errors.staff }
  const errors: Record<string, string> = {}
  for (const row of selected) {
    if (row.salaryRub === null) errors.staff = t.errors.staffSalary(row.role)
    const rowShare = parseDecimal(row.timeSharePct)
    if (rowShare === null || rowShare <= 0 || rowShare > PERCENT) errors[`staff:${row.role}`] = t.errors.staffShare
  }
  return errors
}

/** Проверка перед сохранением: ключ — поле формы, `staff:<группа>` — доля времени строки таблицы. */
export function validateForm(form: ProcessForm): FormErrors {
  const errors: Record<string, string> = {}
  if (form.name.trim() === '') errors.name = t.errors.required
  if (form.carrier.trim() === '') errors.carrier = t.errors.required
  if (parseCategory(form.category) === null) errors.category = t.errors.required
  if (form.handling.length === 0) errors.handling = t.errors.handling
  for (const key of Object.keys(NUMERIC_SPECS) as NumericKey[]) {
    const error = numericError(form, key)
    if (error) errors[key] = error
  }
  for (const method of replaceableMethods(form)) {
    const ratio = parseDecimal(form.replacement[method] ?? '')
    if (ratio === null || ratio < 0 || ratio > 1) errors[`replacement:${method}`] = t.errors.range('0', '1')
  }
  return { ...errors, ...staffErrors(form) }
}

/** Значение уже проверено `validateForm`; пустое необязательное поле — 0. */
const valueOf = (form: ProcessForm, key: NumericKey): number => parseDecimal(form[key]) ?? 0

function toTemplate(form: ProcessForm): ProcessTemplate {
  const category = parseCategory(form.category)
  if (category === null) throw new Error('Категория процесса не выбрана')
  return {
    category,
    route: form.route.trim(),
    peakFactor: valueOf(form, 'peakFactor'),
    speedLimitMps: valueOf(form, 'speedLimitMps'),
    widthMarginM: valueOf(form, 'widthMarginM'),
    liftTripShare: valueOf(form, 'liftTripPct') / PERCENT,
    liftWaitS: valueOf(form, 'liftWaitS'),
    indoor: form.indoor,
    minAisleWidthM: valueOf(form, 'minAisleWidthM'),
    staff: form.staff
      .filter((row) => row.selected)
      .map((row) => ({ role: row.role, timeShare: (parseDecimal(row.timeSharePct) ?? 0) / PERCENT })),
    staffTurnoverShare: valueOf(form, 'turnoverPct') / PERCENT,
    workTimeLossShare: valueOf(form, 'workTimeLossPct') / PERCENT,
    fleetOperatorsPerShift: valueOf(form, 'fleetOperators'),
    fleetOperatorSalaryRub: valueOf(form, 'fleetSalaryRub'),
    sitePreparationShare: valueOf(form, 'sitePrepPct') / PERCENT,
    itIntegrationRub: valueOf(form, 'itIntegrationRub'),
    consumablesRubPerYear: valueOf(form, 'consumablesRub'),
    otherEffectsRubPerYear: valueOf(form, 'otherEffectsRub'),
  }
}

/** «Приёмка → зона хранения → отгрузка» → точки маршрута для карточки процесса 11. */
export function routePoints(route: string): readonly string[] {
  return route.split('→').map((point) => point.trim()).filter((point) => point !== '')
}

/** Форма → процесс библиотеки. Единица объёма и описание берутся из класса операции. */
export function toNewProcess(form: ProcessForm, classUnit: string, classDescription: string): NewProcess {
  const template = toTemplate(form)
  const minTemp = parseDecimal(form.minTempC)
  return {
    name: form.name.trim(),
    description: classDescription,
    operationClass: form.operationClass,
    volumeUnit: classUnit,
    facilityTypes: [template.category.facilityType],
    handling: form.handling.map((method) => {
      const ratio = parseDecimal(form.replacement[method] ?? '')
      return ratio === null ? { method } : { method, laborReplacementRatio: ratio }
    }),
    defaultWorkerRole: template.staff[0]?.role ?? null,
    defaults: {
      carrier: form.carrier.trim(),
      unitMassKg: valueOf(form, 'unitMassKg'),
      cargoDivisible: form.cargoDivisible,
      dailyVolume: valueOf(form, 'dailyVolume'),
      workHoursPerDay: valueOf(form, 'workHours'),
      peakFactor: template.peakFactor,
      routePoints: routePoints(form.route),
      automationShare: valueOf(form, 'automationPct') / PERCENT,
      routeLengthM: valueOf(form, 'routeLengthM'),
      ...(minTemp === null ? {} : { minOperatingTempC: minTemp }),
    },
    template,
  }
}
