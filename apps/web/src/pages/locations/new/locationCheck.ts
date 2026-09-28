import type { NewLocation, ParameterValue, StaffGroup } from '@/domain'
import { formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { siteSectionOf, type SiteGroup } from '../params/siteProfileFields'
import {
  NUMERIC_KEYS,
  NUMERIC_SPECS,
  REQUIRED_TEXT,
  STAFF_PRESETS,
  isTurnoverAssumed,
  num,
  numericRange,
  payrollCoef,
  type LocationForm,
  type NumericKey,
  type ParameterIndex,
  type SectionId,
  type StaffGroupRow,
} from './locationForm'

const t = ru.locationNew

/**
 * Ошибки по ключам: имя поля формы, `staff` — правило таблицы групп,
 * `staff:<ключ строки>:role|headcount|salary` — поля строки.
 */
export type FormErrors = Readonly<Record<string, string>>

interface CheckOptions {
  /** Пустые обязательные поля — ошибка только после попытки сохранить; до этого они просто «не заполнены». */
  readonly showRequired: boolean
}

const isWarehouse = (form: LocationForm): boolean => form.facilityType === 'warehouse'

function numericError(form: LocationForm, key: NumericKey, params: ParameterIndex, { showRequired }: CheckOptions): string | null {
  const spec = NUMERIC_SPECS[key]
  const raw = form[key].trim()
  if (raw === '') return spec.required && showRequired ? t.errors.required : null
  const value = parseDecimal(raw)
  if (value === null) return t.errors.number
  if (spec.integer === true && !Number.isInteger(value)) return t.errors.integer
  const range = numericRange(key, params)
  if (range && (value < range.min || value > range.max)) {
    return t.errors.range(formatNumber(range.min, 3), formatNumber(range.max, 3))
  }
  if (key === 'activeArea') {
    const total = num(form, 'totalArea')
    if (total !== null && value > total) return t.errors.activeOverTotal(formatNumber(total))
  }
  return null
}

function positiveError(raw: string, required: boolean, { showRequired }: CheckOptions): string | null {
  if (raw.trim() === '') return required && showRequired ? t.errors.required : null
  const value = parseDecimal(raw)
  if (value === null) return t.errors.number
  return value > 0 ? null : t.errors.positive
}

/** Строка годится для правила «хотя бы одна группа с численностью и окладом». */
const isCompleteGroup = (row: StaffGroupRow): boolean =>
  row.role.trim() !== '' && (parseDecimal(row.headcount) ?? 0) > 0 && (parseDecimal(row.salary) ?? 0) > 0

function staffErrors(staff: readonly StaffGroupRow[], options: CheckOptions): [string, string][] {
  const rows = staff.flatMap((row): [string, string][] => {
    const prefix = `staff:${row.key}`
    const role = row.role.trim() === '' && options.showRequired ? t.errors.required : null
    const headcount = positiveError(row.headcount, true, options)
    const salary = positiveError(row.salary, false, options)
    return [
      ...(role ? [[`${prefix}:role`, role] as [string, string]] : []),
      ...(headcount ? [[`${prefix}:headcount`, headcount] as [string, string]] : []),
      ...(salary ? [[`${prefix}:salary`, salary] as [string, string]] : []),
    ]
  })
  const rule: [string, string][] = staff.some(isCompleteGroup) ? [] : [['staff', t.errors.staff]]
  return [...rows, ...rule]
}

/** Поля секции «Персонал», которые стоят под таблицей групп (15950:2132). */
const AFTER_TABLE: readonly NumericKey[] = ['pickerProductivity', 'workTimeLoss', 'turnover']

/** Проверка формы. Ключи — в порядке полей на экране: первая ошибка — первая по ходу формы. */
export function validateLocation(form: LocationForm, params: ParameterIndex, options: CheckOptions): FormErrors {
  const text = REQUIRED_TEXT.flatMap((key): [string, string][] =>
    form[key].trim() === '' && options.showRequired ? [[key, t.errors.required]] : [],
  )
  if (!isWarehouse(form)) return Object.fromEntries(text)
  const numeric = NUMERIC_KEYS.flatMap((key): [string, string][] => {
    const error = numericError(form, key, params, options)
    return error ? [[key, error]] : []
  })
  // Порядок на экране: сначала поля секции «Персонал» до таблицы, затем таблица, затем поля после неё.
  const beforeTable = numeric.filter(([key]) => !AFTER_TABLE.includes(key as NumericKey))
  const afterTable = numeric.filter(([key]) => AFTER_TABLE.includes(key as NumericKey))
  return Object.fromEntries([...text, ...beforeTable, ...staffErrors(form.staff, options), ...afterTable])
}

/** Секция, где стоит поле с ошибкой, — для перехода из панели готовности. */
export function errorSection(key: string): SectionId | SiteGroup {
  const site = siteSectionOf(key)
  if (site) return site
  if (key === 'name' || key === 'city' || key === 'address') return 'basics'
  if (key in NUMERIC_SPECS) return NUMERIC_SPECS[key as NumericKey].section
  return 'staff'
}

export interface Readiness {
  readonly requiredDone: number
  readonly requiredTotal: number
  readonly filled: number
  readonly filledTotal: number
  readonly errors: number
  readonly assumptions: number
  readonly optionalEmpty: number
}

/**
 * Счётчики панели «Готовность профиля» (PRD 10.2). Правило, снимающее противоречие PRD 15 · №44:
 * «N / M обязательных» — обязательные поля, заполненные без ошибки; «Заполнено полей» — непустые поля, верные или нет.
 * Поля: тип, название, город, адрес + 11 числовых + норматив начислений = 16 у склада; таблица групп — отдельное правило.
 * Допущения панели формы — плашка у текучести, пока она принятый 0 (PRD 10.2). На карточке локации считаются все параметры с источником assumption.
 */
export function readiness(form: LocationForm, errors: FormErrors, params: ParameterIndex): Readiness {
  const filledText = (key: 'name' | 'city' | 'address') => form[key].trim() !== ''
  const errorCount = Object.keys(errors).length
  const typeAndText = {
    requiredTotal: 1 + REQUIRED_TEXT.length,
    requiredDone: 1 + REQUIRED_TEXT.filter((k) => filledText(k) && errors[k] === undefined).length,
    filledTotal: 4,
    filled: 1 + (['name', 'city', 'address'] as const).filter(filledText).length,
    optionalEmpty: filledText('address') ? 0 : 1,
  }
  if (!isWarehouse(form)) return { ...typeAndText, errors: errorCount, assumptions: 0 }

  const filledNumeric = NUMERIC_KEYS.filter((key) => form[key].trim() !== '')
  const required = NUMERIC_KEYS.filter((key) => NUMERIC_SPECS[key].required)
  const payroll = payrollCoef(params) === null ? 0 : 1
  return {
    requiredTotal: typeAndText.requiredTotal + required.length,
    requiredDone: typeAndText.requiredDone + required.filter((k) => filledNumeric.includes(k) && errors[k] === undefined).length,
    filledTotal: typeAndText.filledTotal + NUMERIC_KEYS.length + payroll,
    filled: typeAndText.filled + filledNumeric.length + payroll,
    errors: errorCount,
    assumptions: form.turnover.trim() !== '' && isTurnoverAssumed(form) ? 1 : 0,
    optionalEmpty: typeAndText.optionalEmpty + NUMERIC_KEYS.filter((k) => !NUMERIC_SPECS[k].required && !filledNumeric.includes(k)).length,
  }
}

const MILLION = 1_000_000
/** Датасет склада, приложение А: горизонт ТЭО и ориентир CAPEX, если справочник тип объекта их не отдал. */
const DEFAULT_HORIZON_YEARS = 5
const DEFAULT_CAPEX_MLN = 80

function numericParameters(form: LocationForm): [string, ParameterValue][] {
  return NUMERIC_KEYS.flatMap((key): [string, ParameterValue][] => {
    const value = num(form, key)
    if (value === null) return []
    const source = key === 'turnover' && isTurnoverAssumed(form) ? 'assumption' : 'user'
    return [[NUMERIC_SPECS[key].code, { value, source }]]
  })
}

/** Коды групп персонала: в api это `staffGroups`, не `parameters` (PRD 10.2 — таблица ролей). */
const STAFF_PARAMETER_CODES: ReadonlySet<string> = new Set(
  STAFF_PRESETS.flatMap((p) => (p.salaryCode === null ? [p.headcountCode] : [p.headcountCode, p.salaryCode])),
)

/** Значения формы, которые api принимает как параметры типа объекта. */
function profileParameters(form: LocationForm, params: ParameterIndex): Readonly<Record<string, ParameterValue>> {
  const coef = payrollCoef(params)
  const payroll: [string, ParameterValue][] = coef === null ? [] : [['wh_payroll_tax_coef', { value: coef, source: 'organizer' }]]
  return Object.fromEntries(
    [...numericParameters(form), ...payroll]
      .filter(([code]) => params.has(code) && !STAFF_PARAMETER_CODES.has(code)),
  )
}

function datasetNumber(params: ParameterIndex, code: string, fallback: number): number {
  const value = baseNumber(params, code)
  return value > 0 ? value : fallback
}

function staffGroups(staff: readonly StaffGroupRow[]): readonly StaffGroup[] {
  return staff.flatMap((row) => {
    const headcount = parseDecimal(row.headcount)
    if (row.role.trim() === '' || headcount === null) return []
    return [{ role: row.role.trim(), headcount, salaryGrossMonthRub: parseDecimal(row.salary) }]
  })
}

const baseNumber = (params: ParameterIndex, code: string): number => {
  const base = params.get(code)?.base
  return typeof base === 'number' ? base : 0
}

/**
 * Локация для `POST /locations` в модели api (PRD 10.2): поля склада, параметры справочника, группы персонала.
 * Бюджет и горизонт на форме нет — из датасета (приложение А), иначе 80 млн ₽ и 5 лет.
 */
export function toNewLocation(form: LocationForm, params: ParameterIndex): NewLocation {
  return {
    name: form.name.trim(),
    city: form.city.trim(),
    address: form.address.trim(),
    facilityType: 'warehouse',
    capexBudgetRub: datasetNumber(params, 'wh_capex_budget', DEFAULT_CAPEX_MLN) * MILLION,
    horizonYears: datasetNumber(params, 'wh_horizon_years', DEFAULT_HORIZON_YEARS),
    parameters: profileParameters(form, params),
    staffGroups: staffGroups(form.staff),
  }
}
