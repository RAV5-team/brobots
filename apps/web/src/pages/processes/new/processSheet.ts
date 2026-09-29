import { HANDLING_METHOD_CODES, type HandlingMethod, type HandlingMethodCode, type OperationClassCode } from '@/domain'
import { cleanCell, tableFromFile, tableFromText } from '@/pages/locations/new/locationWorkbook'
import { toCsv } from '@/shared/dom/download'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { NUMERIC_SPECS, replaceableMethods, type NumericKey, type ProcessForm, type SectionId, type StaffRow } from './processForm'

const t = ru.processNew

/** Столбцы листа «Процесс» — те же, что у локации (PRD 10.6). Пользователь меняет только «Значение». */
const HEADERS = ['Код параметра', 'Группа', 'Параметр', 'Ед. изм.', 'Значение', 'Базовое значение', 'Min', 'Max', 'Обязательно', 'Примечание'] as const
const CODE_HEADER = HEADERS[0]
const VALUE_HEADER = HEADERS[4]

const PROC_CLASS = 'proc_class'
const PROC_NAME = 'proc_name'
const PROC_CATEGORY = 'proc_category'
const PROC_CARRIER = 'proc_carrier'
const PROC_DIVISIBLE = 'proc_cargo_divisible'
const PROC_ROUTE = 'proc_route'
const PROC_HANDLING = 'proc_handling'
const PROC_INDOOR = 'proc_indoor'

const YES = 'да'
const NO = 'нет'
const PROFILE_NOTE = 'Из профиля локации: в форме не меняется'

const VOLUME_KEYS = ['dailyVolume', 'workHours', 'peakFactor', 'automationPct'] as const satisfies readonly NumericKey[]
const ROUTE_BEFORE_INDOOR = ['routeLengthM', 'speedLimitMps', 'widthMarginM', 'liftTripPct', 'liftWaitS'] as const satisfies readonly NumericKey[]
const ROUTE_AFTER_INDOOR = ['minAisleWidthM', 'minTempC'] as const satisfies readonly NumericKey[]
const STAFF_KEYS = ['turnoverPct', 'workTimeLossPct'] as const satisfies readonly NumericKey[]
const COST_KEYS = ['fleetOperators', 'fleetSalaryRub', 'sitePrepPct', 'itIntegrationRub', 'consumablesRub', 'otherEffectsRub'] as const satisfies readonly NumericKey[]

export interface ProcessSheetCatalog {
  /** Форма 16: класс задан шаблоном и из файла не берётся (PRD 10.4). */
  readonly classLocked: boolean
  readonly classes: readonly { readonly value: OperationClassCode; readonly label: string }[]
  readonly categories: readonly { readonly value: string; readonly label: string }[]
  readonly handlingMethods: readonly HandlingMethod[]
}

export type SheetApplyResult =
  | { readonly ok: true; readonly form: ProcessForm; readonly applied: number; readonly unknown: readonly string[] }
  | { readonly ok: false }

/** Шаблон текущей формы: столбец «Значение» уже заполнен тем, что на экране. */
export function processSheetCsv(form: ProcessForm, catalog: ProcessSheetCatalog): string {
  return toCsv([HEADERS, ...sheetRows(form, catalog)])
}

/** Перенести столбец «Значение» в форму. Чужие коды не затирают поля. */
export function applyProcessSheet(form: ProcessForm, catalog: ProcessSheetCatalog, csv: string): SheetApplyResult {
  return applyProcessTable(form, catalog, tableFromText(csv))
}

/** То же для файла с диска: Excel сохраняет CSV в кодировке Windows или книгу .xlsx. */
export async function applyProcessFile(form: ProcessForm, catalog: ProcessSheetCatalog, file: File): Promise<SheetApplyResult> {
  return applyProcessTable(form, catalog, await tableFromFile(await file.arrayBuffer()))
}

function applyProcessTable(form: ProcessForm, catalog: ProcessSheetCatalog, table: readonly (readonly string[])[]): SheetApplyResult {
  const headerAt = table.findIndex((row) => row.some((cell) => cleanCell(cell) === CODE_HEADER))
  const header = headerAt >= 0 ? table[headerAt] : undefined
  if (!header) return { ok: false }
  const codeAt = header.findIndex((cell) => cleanCell(cell) === CODE_HEADER)
  const valueAt = header.findIndex((cell) => cleanCell(cell) === VALUE_HEADER)
  if (codeAt < 0 || valueAt < 0) return { ok: false }

  let next = form
  const staff = new Map<string, StaffPatch>()
  const replacement: Partial<Record<HandlingMethodCode, string>> = {}
  const unknown: string[] = []
  let applied = 0

  for (const row of table.slice(headerAt + 1)) {
    const code = cleanCell(row[codeAt] ?? '')
    if (code === '') continue
    const value = cleanCell(row[valueAt] ?? '')
    const written = writeRow(form, catalog, staff, replacement, code, value)
    if (written === 'unknown') unknown.push(code)
    else if (written === 'applied') {
      next = writtenForm(next, catalog, code, value)
      applied += 1
    }
  }

  return {
    ok: true,
    form: { ...next, replacement: { ...form.replacement, ...replacement }, staff: mergeStaff(form.staff, staff) },
    applied,
    unknown,
  }
}

type WriteResult = 'applied' | 'readonly' | 'unknown'

function writeRow(
  form: ProcessForm,
  catalog: ProcessSheetCatalog,
  staff: Map<string, StaffPatch>,
  replacement: Partial<Record<HandlingMethodCode, string>>,
  code: string,
  value: string,
): WriteResult {
  if (code === PROC_CLASS) {
    if (catalog.classLocked) return 'readonly'
    return parseChoice(value, catalog.classes) ? 'applied' : 'unknown'
  }
  if (code === PROC_NAME || code === PROC_CARRIER || code === PROC_ROUTE) return 'applied'
  if (code === PROC_CATEGORY) return parseChoice(value, catalog.categories) ? 'applied' : 'unknown'
  if (code === PROC_DIVISIBLE || code === PROC_INDOOR) return parseYesNo(value) === null ? 'unknown' : 'applied'
  if (code === PROC_HANDLING) return parseHandling(value, catalog.handlingMethods) ? 'applied' : 'unknown'
  if (isNumericKey(code)) return 'applied'
  const staffField = staffFieldOf(code)
  if (staffField) return writeStaff(form, staff, staffField, value)
  const method = replacementCode(code)
  if (method) {
    if (method === 'none') return 'unknown'
    replacement[method] = value
    return 'applied'
  }
  return 'unknown'
}

function writtenForm(form: ProcessForm, catalog: ProcessSheetCatalog, code: string, value: string): ProcessForm {
  if (code === PROC_CLASS) {
    const operationClass = parseChoice(value, catalog.classes)
    return operationClass ? { ...form, operationClass } : form
  }
  if (code === PROC_NAME) return { ...form, name: value }
  if (code === PROC_CATEGORY) {
    const category = parseChoice(value, catalog.categories)
    return category ? { ...form, category } : form
  }
  if (code === PROC_CARRIER) return { ...form, carrier: value }
  if (code === PROC_ROUTE) return { ...form, route: value }
  if (code === PROC_DIVISIBLE) {
    const cargoDivisible = parseYesNo(value)
    return cargoDivisible === null ? form : { ...form, cargoDivisible }
  }
  if (code === PROC_INDOOR) {
    const indoor = parseYesNo(value)
    return indoor === null ? form : { ...form, indoor }
  }
  if (code === PROC_HANDLING) {
    const handling = parseHandling(value, catalog.handlingMethods)
    return handling ? { ...form, handling } : form
  }
  if (isNumericKey(code)) return { ...form, [code]: value }
  return form
}

function sheetRows(form: ProcessForm, catalog: ProcessSheetCatalog): string[][] {
  const f = t.fields
  const classLabel = catalog.classes.find((item) => item.value === form.operationClass)?.label ?? form.operationClass
  const categoryLabel = catalog.categories.find((item) => item.value === form.category)?.label ?? form.category
  const handling = form.handling.map((code) => catalog.handlingMethods.find((method) => method.code === code)?.name ?? code).join(', ')
  return [
    choiceRow(PROC_CLASS, 'process', f.operationClass.label, classLabel, true, catalog.classLocked ? f.operationClass.lockedHint : f.operationClass.hint),
    choiceRow(PROC_NAME, 'process', f.name.label, form.name, true, f.name.hint),
    choiceRow(PROC_CATEGORY, 'process', f.category.label, categoryLabel, false, f.category.hint),
    choiceRow(PROC_CARRIER, 'process', f.carrier.label, form.carrier, true, ''),
    numericRow('unitMassKg', form.unitMassKg),
    choiceRow(PROC_DIVISIBLE, 'process', f.cargoDivisible.label, yesNo(form.cargoDivisible), true, f.cargoDivisible.hint),
    choiceRow(PROC_ROUTE, 'process', f.route.label, form.route, false, f.route.hint),
    choiceRow(PROC_HANDLING, 'process', f.handling.label, handling, true, f.handling.hint),
    ...VOLUME_KEYS.map((key) => numericRow(key, form[key])),
    ...ROUTE_BEFORE_INDOOR.map((key) => numericRow(key, form[key])),
    choiceRow(PROC_INDOOR, 'route', f.indoor.label, yesNo(form.indoor), false, f.indoor.hint),
    ...ROUTE_AFTER_INDOOR.map((key) => numericRow(key, form[key])),
    ...form.staff.flatMap(staffRows),
    ...replacementRows(form, catalog.handlingMethods),
    ...STAFF_KEYS.map((key) => numericRow(key, form[key])),
    ...COST_KEYS.map((key) => numericRow(key, form[key])),
  ]
}

function staffRows(row: StaffRow): string[][] {
  const s = t.staffTable
  const people = formatNumber(row.headcount)
  const salary = row.salaryRub === null ? s.salaryMissing : formatNumber(row.salaryRub)
  return [
    choiceRow(`staff:${row.role}:selected`, 'staff', `${s.select}: ${row.role}`, yesNo(row.selected), false, ''),
    choiceRow(`staff:${row.role}:headcount`, 'staff', `${s.headcount}: ${row.role}`, people, false, PROFILE_NOTE, 'чел.'),
    choiceRow(`staff:${row.role}:salary`, 'staff', `${s.salary}: ${row.role}`, salary, false, PROFILE_NOTE, '₽'),
    choiceRow(`staff:${row.role}:share`, 'staff', s.timeShareLabel(row.role), row.timeSharePct, row.selected, s.note, '%'),
  ]
}

function replacementRows(form: ProcessForm, methods: readonly HandlingMethod[]): string[][] {
  return replaceableMethods(form).map((code) => {
    const name = methods.find((method) => method.code === code)?.name ?? code
    return choiceRow(`replacement:${code}`, 'staff', t.replacementLabel(name), form.replacement[code] ?? '', true, t.replacementHints[code] ?? '', t.replacementUnit)
  })
}

function numericRow(key: NumericKey, value: string): string[] {
  const spec = NUMERIC_SPECS[key]
  const field = t.fields[key]
  return [
    key,
    t.nav[spec.section],
    field.label,
    field.unit,
    value,
    '',
    formatNumber(spec.min, 3),
    formatNumber(spec.max, 3),
    spec.required === true ? YES : NO,
    'hint' in field ? field.hint ?? '' : '',
  ]
}

function choiceRow(code: string, section: SectionId, name: string, value: string, required: boolean, note: string, unit = ''): string[] {
  return [code, t.nav[section], name, unit, value, '', '', '', required ? YES : NO, note]
}

function parseChoice<T extends string>(value: string, options: readonly { readonly value: T; readonly label: string }[]): T | null {
  const text = value.trim()
  const byValue = options.find((item) => item.value === text)
  if (byValue) return byValue.value
  const lower = text.toLocaleLowerCase('ru-RU')
  return options.find((item) => item.label.toLocaleLowerCase('ru-RU') === lower)?.value ?? null
}

function parseYesNo(value: string): boolean | null {
  const text = value.trim().toLocaleLowerCase('ru-RU')
  if (text === YES || text === 'yes') return true
  if (text === NO || text === 'no') return false
  return null
}

function parseHandling(value: string, methods: readonly HandlingMethod[]): readonly HandlingMethodCode[] | null {
  const parts = value.split(/[,;]/).map((part) => part.trim()).filter((part) => part !== '')
  const codes: HandlingMethodCode[] = []
  for (const part of parts) {
    const lower = part.toLocaleLowerCase('ru-RU')
    const found = methods.find((method) => method.code === part || method.name.toLocaleLowerCase('ru-RU') === lower)
    if (!found) return null
    if (!codes.includes(found.code)) codes.push(found.code)
  }
  return codes
}

const isNumericKey = (code: string): code is NumericKey => code in NUMERIC_SPECS

const isHandlingCode = (code: string): code is HandlingMethodCode =>
  HANDLING_METHOD_CODES.some((method) => method === code)

function replacementCode(code: string): HandlingMethodCode | null {
  const match = /^replacement:([a-z]+)$/.exec(code)
  const method = match?.[1]
  return method && isHandlingCode(method) ? method : null
}

interface StaffPatch {
  readonly selected?: boolean
  readonly timeSharePct?: string
}

function staffFieldOf(code: string): { readonly role: string; readonly field: 'selected' | 'share' | 'headcount' | 'salary' } | null {
  const match = /^staff:(.+):(selected|share|headcount|salary)$/.exec(code)
  const role = match?.[1]
  const field = match?.[2]
  if (!role || (field !== 'selected' && field !== 'share' && field !== 'headcount' && field !== 'salary')) return null
  return { role, field }
}

function writeStaff(form: ProcessForm, staff: Map<string, StaffPatch>, field: { readonly role: string; readonly field: 'selected' | 'share' | 'headcount' | 'salary' }, value: string): WriteResult {
  if (!form.staff.some((row) => row.role === field.role)) return 'unknown'
  if (field.field === 'headcount' || field.field === 'salary') return 'readonly'
  if (field.field === 'selected') {
    const selected = parseYesNo(value)
    if (selected === null) return 'unknown'
    staff.set(field.role, { ...staff.get(field.role), selected })
    return 'applied'
  }
  staff.set(field.role, { ...staff.get(field.role), timeSharePct: value })
  return 'applied'
}

function mergeStaff(staff: readonly StaffRow[], patches: ReadonlyMap<string, StaffPatch>): readonly StaffRow[] {
  return staff.map((row) => {
    const patch = patches.get(row.role)
    if (!patch) return row
    return {
      ...row,
      ...(patch.selected !== undefined ? { selected: patch.selected } : {}),
      ...(patch.timeSharePct !== undefined ? { timeSharePct: patch.timeSharePct } : {}),
    }
  })
}

const yesNo = (value: boolean): string => (value ? YES : NO)
