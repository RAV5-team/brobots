import type { FacilityParameter } from '@/domain'
import { toCsv } from '@/shared/dom/download'
import { cleanCell, tableFromFile, tableFromText } from './locationWorkbook'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  FACILITY_CHOICES,
  NUMERIC_KEYS,
  NUMERIC_SPECS,
  REQUIRED_TEXT,
  STAFF_PRESETS,
  extraFields,
  type FacilityChoice,
  type LocationForm,
  type NumericKey,
  type ParameterIndex,
  type StaffGroupRow,
  type TextKey,
} from './locationForm'

const t = ru.locationNew

/** Столбцы листа «Локация» (PRD 10.6). Пользователь меняет только «Значение». */
const HEADERS = ['Код параметра', 'Группа', 'Параметр', 'Ед. изм.', 'Значение', 'Базовое значение', 'Min', 'Max', 'Обязательно', 'Примечание'] as const
const CODE_HEADER = HEADERS[0]
const VALUE_HEADER = HEADERS[4]

const LOC_NAME = 'loc_name'
const LOC_CITY = 'loc_city'
const LOC_ADDRESS = 'loc_address'
const LOC_TYPE = 'loc_facility_type'
/** Норматив платформы: в форме только для чтения, в файле — чтобы строка не потерялась. */
const PAYROLL_CODE = 'wh_payroll_tax_coef'

const YES = 'да'
const NO = 'нет'

const TEXT_FIELDS: Readonly<Record<TextKey, { readonly code: string; readonly label: string }>> = {
  name: { code: LOC_NAME, label: t.text.name.label },
  city: { code: LOC_CITY, label: t.text.city.label },
  address: { code: LOC_ADDRESS, label: t.text.address.label },
}

export type SheetApplyResult =
  | { readonly ok: true; readonly form: LocationForm; readonly applied: number; readonly unknown: readonly string[] }
  | { readonly ok: false }

/** Шаблон текущей формы: столбец «Значение» уже заполнен тем, что на экране. */
export function locationSheetCsv(form: LocationForm, params: ParameterIndex): string {
  const rows = [HEADERS, ...sheetRows(form, params)]
  return toCsv(rows)
}

/** Перенести столбец «Значение» в форму. Чужие коды не затирают поля. */
export function applyLocationSheet(form: LocationForm, params: ParameterIndex, csv: string): SheetApplyResult {
  return applyLocationTable(form, params, tableFromText(csv))
}

/** То же для файла с диска: Excel сохраняет CSV в кодировке Windows или книгу .xlsx. */
export async function applyLocationFile(form: LocationForm, params: ParameterIndex, file: File): Promise<SheetApplyResult> {
  return applyLocationTable(form, params, await tableFromFile(await file.arrayBuffer()))
}

function applyLocationTable(form: LocationForm, params: ParameterIndex, table: readonly (readonly string[])[]): SheetApplyResult {
  const headerAt = table.findIndex((row) => row.some((cell) => cleanCell(cell) === CODE_HEADER))
  const header = headerAt >= 0 ? table[headerAt] : undefined
  if (!header) return { ok: false }
  const codeAt = header.findIndex((cell) => cleanCell(cell) === CODE_HEADER)
  const valueAt = header.findIndex((cell) => cleanCell(cell) === VALUE_HEADER)
  if (codeAt < 0 || valueAt < 0) return { ok: false }

  const numericByCode = new Map<string, NumericKey>(NUMERIC_KEYS.map((key) => [NUMERIC_SPECS[key].code, key]))
  const extraCodes = new Set(extraFields(params).map((field) => field.code))
  let next: LocationForm = form
  const staff = new Map<string, StaffPatch>()
  const unknown: string[] = []
  let applied = 0

  for (const row of table.slice(headerAt + 1)) {
    const code = cleanCell(row[codeAt] ?? '')
    if (code === '') continue
    const value = cleanCell(row[valueAt] ?? '')
    const written = writeRow(params, numericByCode, extraCodes, staff, code, value)
    if (written === 'unknown') unknown.push(code)
    else if (written === 'applied') {
      next = writtenForm(next, code, value, numericByCode, extraCodes)
      applied += 1
    }
  }

  return { ok: true, form: { ...next, staff: mergeStaff(form.staff, staff) }, applied, unknown }
}

type WriteResult = 'applied' | 'readonly' | 'unknown'

function writeRow(
  params: ParameterIndex,
  numericByCode: ReadonlyMap<string, NumericKey>,
  extraCodes: ReadonlySet<string>,
  staff: Map<string, StaffPatch>,
  code: string,
  value: string,
): WriteResult {
  if (code === PAYROLL_CODE) return 'readonly'
  if (code === LOC_TYPE) return facilityChoice(value) ? 'applied' : 'unknown'
  if (code === LOC_NAME || code === LOC_CITY || code === LOC_ADDRESS) return 'applied'
  if (numericByCode.has(code) || extraCodes.has(code)) return 'applied'
  const staffField = staffFieldOf(code)
  if (staffField) {
    const prev = staff.get(staffField.key) ?? {}
    staff.set(staffField.key, { ...prev, [staffField.field]: value })
    return 'applied'
  }
  if (params.has(code)) return 'readonly'
  return 'unknown'
}

function writtenForm(
  form: LocationForm,
  code: string,
  value: string,
  numericByCode: ReadonlyMap<string, NumericKey>,
  extraCodes: ReadonlySet<string>,
): LocationForm {
  if (code === LOC_TYPE) {
    const facilityType = facilityChoice(value)
    return facilityType ? { ...form, facilityType } : form
  }
  const text = (Object.entries(TEXT_FIELDS) as [TextKey, { readonly code: string }][]).find(([, field]) => field.code === code)
  if (text) return { ...form, [text[0]]: value }
  const numeric = numericByCode.get(code)
  if (numeric) return { ...form, [numeric]: value }
  if (extraCodes.has(code)) return { ...form, extras: { ...form.extras, [code]: value } }
  return form
}

function sheetRows(form: LocationForm, params: ParameterIndex): string[][] {
  const basics = t.nav.basics
  const type = t.facilityType.options[form.facilityType]
  const head = [
    plainRow(LOC_TYPE, basics, t.facilityType.label, '', type, '', YES, 'Склад, аэропорт, медучреждение или свой объект'),
    ...REQUIRED_TEXT.map((key) => plainRow(TEXT_FIELDS[key].code, basics, TEXT_FIELDS[key].label, '', form[key], '', YES, '')),
    plainRow(TEXT_FIELDS.address.code, basics, TEXT_FIELDS.address.label, '', form.address, '', NO, ''),
  ]
  if (form.facilityType !== 'warehouse') return head
  const numbers = NUMERIC_KEYS.map((key) => catalogRow(params, NUMERIC_SPECS[key].code, form[key], NUMERIC_SPECS[key].required))
  const staff = form.staff.flatMap((row) => staffRows(params, row))
  const extras = extraFields(params).map((field) => catalogRow(params, field.code, form.extras[field.code] ?? '', false))
  const payroll = params.has(PAYROLL_CODE) ? [catalogRow(params, PAYROLL_CODE, payrollText(params), false)] : []
  return [...head, ...numbers, ...staff, ...extras, ...payroll]
}

function staffRows(params: ParameterIndex, row: StaffGroupRow): string[][] {
  const preset = STAFF_PRESETS.find((item) => item.headcountCode === row.key)
  if (preset) {
    const salary = preset.salaryCode === null ? [] : [catalogRow(params, preset.salaryCode, row.salary, false)]
    return [catalogRow(params, preset.headcountCode, row.headcount, false), ...salary]
  }
  const group = t.nav.staff
  return [
    plainRow(`staff:${row.key}:role`, group, t.staffTable.role, '', row.role, '', NO, ''),
    plainRow(`staff:${row.key}:headcount`, group, t.staffTable.headcount, t.staffTable.people, row.headcount, '', NO, ''),
    plainRow(`staff:${row.key}:salary`, group, t.staffTable.salary, t.staffTable.salaryUnit, row.salary, '', NO, ''),
  ]
}

function catalogRow(params: ParameterIndex, code: string, value: string, required: boolean): string[] {
  const parameter = params.get(code)
  return [
    code,
    parameter?.group ?? '',
    parameter?.name ?? code,
    parameter?.unit ?? '',
    value,
    parameter ? baseOf(parameter) : '',
    bound(parameter?.min),
    bound(parameter?.max),
    required ? YES : NO,
    parameter?.note ?? '',
  ]
}

function plainRow(code: string, group: string, name: string, unit: string, value: string, base: string, required: string, note: string): string[] {
  return [code, group, name, unit, value, base, '', '', required, note]
}

const baseOf = (parameter: FacilityParameter): string =>
  typeof parameter.base === 'number' ? formatNumber(parameter.base, 3) : parameter.base

const bound = (value: number | null | undefined): string => (typeof value === 'number' ? formatNumber(value, 3) : '')

const payrollText = (params: ParameterIndex): string => {
  const base = params.get(PAYROLL_CODE)?.base
  return typeof base === 'number' ? formatNumber(base, 3) : ''
}

function facilityChoice(value: string): FacilityChoice | null {
  const text = value.trim().toLowerCase()
  const byCode = FACILITY_CHOICES.find((choice) => choice === text)
  if (byCode) return byCode
  const found = FACILITY_CHOICES.find((choice) => t.facilityType.options[choice].toLowerCase() === text)
  return found ?? null
}

interface StaffPatch {
  readonly role?: string
  readonly headcount?: string
  readonly salary?: string
}

function staffFieldOf(code: string): { readonly key: string; readonly field: keyof StaffPatch } | null {
  const custom = /^staff:([^:]+):(role|headcount|salary)$/.exec(code)
  const customKey = custom?.[1]
  const customField = custom?.[2]
  if (customKey && (customField === 'role' || customField === 'headcount' || customField === 'salary')) {
    return { key: customKey, field: customField }
  }
  for (const preset of STAFF_PRESETS) {
    if (code === preset.headcountCode) return { key: preset.headcountCode, field: 'headcount' }
    if (preset.salaryCode !== null && code === preset.salaryCode) return { key: preset.headcountCode, field: 'salary' }
  }
  return null
}

function mergeStaff(staff: readonly StaffGroupRow[], patches: ReadonlyMap<string, StaffPatch>): readonly StaffGroupRow[] {
  const next = staff.map((row) => {
    const patch = patches.get(row.key)
    return patch ? applyPatch(row, patch) : row
  })
  for (const [key, patch] of patches) {
    if (staff.some((row) => row.key === key)) continue
    const preset = STAFF_PRESETS.find((item) => item.headcountCode === key)
    next.push(applyPatch({
      key,
      role: preset?.role ?? '',
      headcount: '',
      salary: '',
      preset: preset !== undefined,
    }, patch))
  }
  return next
}

function applyPatch(row: StaffGroupRow, patch: StaffPatch): StaffGroupRow {
  return {
    ...row,
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.headcount !== undefined ? { headcount: patch.headcount } : {}),
    ...(patch.salary !== undefined ? { salary: patch.salary } : {}),
  }
}

