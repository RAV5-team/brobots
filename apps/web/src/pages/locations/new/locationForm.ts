import type { FacilityParameter, FacilityTypeCode } from '@/domain'
import { formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

/** Секции формы в порядке навигации (PRD 10.2). */
export const SECTION_IDS = ['basics', 'area', 'schedule', 'staff'] as const
export type SectionId = (typeof SECTION_IDS)[number]

/** Тип объекта на переключателе: три типа справочника и «Свой объект» (PRD 10.2, ТЗ 2). */
export type FacilityChoice = FacilityTypeCode | 'custom'
export const FACILITY_CHOICES: readonly FacilityChoice[] = ['warehouse', 'airport', 'medical', 'custom']

/** Числовые поля хранятся строкой, как введены: «1,5», «20 000». Разбор — `parseDecimal`. */
export interface NumericValues {
  readonly totalArea: string
  readonly activeArea: string
  readonly floors: string
  readonly shifts: string
  readonly workingDays: string
  readonly shiftHours: string
  readonly peakFactor: string
  readonly staffTotal: string
  readonly pickerProductivity: string
  readonly workTimeLoss: string
  readonly turnover: string
}
export type NumericKey = keyof NumericValues

/** Группа персонала — те, кого роботы могут частично заменить (PRD 10.2). */
export interface StaffGroupRow {
  /** Стабильный ключ строки: код параметра датасета у стандартных групп, `custom-N` у добавленных. */
  readonly key: string
  readonly role: string
  readonly headcount: string
  readonly salary: string
  /** Группа из датасета склада: роль не меняется, подсказка — диапазоны датасета. */
  readonly preset: boolean
}

export interface LocationForm extends NumericValues {
  readonly facilityType: FacilityChoice
  readonly name: string
  readonly city: string
  readonly address: string
  readonly staff: readonly StaffGroupRow[]
}

export type TextKey = 'name' | 'city' | 'address'

interface NumericSpec {
  /** Код параметра склада: так значение сохраняется в профиль локации. */
  readonly code: string
  readonly section: Exclude<SectionId, 'basics'>
  readonly required: boolean
  readonly integer?: boolean
  /** Допустимый диапазон, если в датасете его нет или он вырожден (рабочих дней 365–365). */
  readonly range?: Range
}

export interface Range {
  readonly min: number
  readonly max: number
}

/**
 * Годовая текучесть персонала (PRD 10.2): на форме — допущение 0, процесс наследует из профиля (PRD 9).
 * Код есть у склада в справочнике типа объекта (`role: turnover`), как у аэропорта и медучреждения.
 */
const TURNOVER_CODE = 'wh_annual_turnover'
export const ASSUMED_TURNOVER = 0
const PAYROLL_CODE = 'wh_payroll_tax_coef'

export const NUMERIC_SPECS: Readonly<Record<NumericKey, NumericSpec>> = {
  totalArea: { code: 'wh_total_area', section: 'area', required: true },
  activeArea: { code: 'wh_active_area', section: 'area', required: true },
  floors: { code: 'wh_floors', section: 'area', required: false, integer: true },
  shifts: { code: 'wh_shifts', section: 'schedule', required: true, integer: true },
  workingDays: { code: 'wh_working_days', section: 'schedule', required: false, integer: true, range: { min: 1, max: 365 } },
  shiftHours: { code: 'wh_shift_hours', section: 'schedule', required: true },
  peakFactor: { code: 'wh_peak_factor', section: 'schedule', required: true },
  staffTotal: { code: 'wh_staff_total', section: 'staff', required: true, integer: true },
  pickerProductivity: { code: 'wh_picker_productivity', section: 'staff', required: false },
  workTimeLoss: { code: 'wh_work_time_loss', section: 'staff', required: false },
  turnover: { code: TURNOVER_CODE, section: 'staff', required: false, range: { min: 0, max: 100 } },
}

export const NUMERIC_KEYS = Object.keys(NUMERIC_SPECS) as readonly NumericKey[]
/** Обязательные текстовые поля секции «Основное»; тип объекта выбран всегда. */
export const REQUIRED_TEXT: readonly TextKey[] = ['name', 'city']

/** Стандартные группы склада и их параметры в датасете; у упаковщиков оклада в датасете нет (PRD 15 · №48). */
export const STAFF_PRESETS: readonly { readonly role: string; readonly headcountCode: string; readonly salaryCode: string | null }[] = [
  { role: ru.staffRoles.pickers, headcountCode: 'wh_pickers', salaryCode: 'wh_picker_salary' },
  { role: ru.staffRoles.forkliftOperators, headcountCode: 'wh_forklift_operators', salaryCode: 'wh_forklift_salary' },
  { role: ru.staffRoles.packingOperators, headcountCode: 'wh_packing_operators', salaryCode: null },
]

/** Параметры склада по коду. */
export type ParameterIndex = ReadonlyMap<string, FacilityParameter>
export const indexParameters = (params: readonly FacilityParameter[]): ParameterIndex => new Map(params.map((p) => [p.code, p]))

/** Диапазон поля: свой у спецификации, иначе из датасета. */
export function numericRange(key: NumericKey, params: ParameterIndex): Range | null {
  const spec = NUMERIC_SPECS[key]
  if (spec.range) return spec.range
  const param = params.get(spec.code)
  return param && param.min !== null && param.max !== null ? { min: param.min, max: param.max } : null
}

export function parameterRange(code: string | null, params: ParameterIndex): Range | null {
  const param = code === null ? undefined : params.get(code)
  return param && param.min !== null && param.max !== null ? { min: param.min, max: param.max } : null
}

/** Коэффициент начислений на ФОТ — норматив платформы, в форме только для чтения (PRD 6.8). */
export function payrollCoef(params: ParameterIndex): number | null {
  const base = params.get(PAYROLL_CODE)?.base
  return typeof base === 'number' ? base : null
}

const baseText = (params: ParameterIndex, code: string | null): string => {
  const base = code === null ? undefined : params.get(code)?.base
  return typeof base === 'number' ? formatNumber(base, 3) : ''
}

export const num = (form: LocationForm, key: NumericKey): number | null => parseDecimal(form[key])

/** Годовая текучесть осталась принятым нулём — значение считается допущением, а не данными площадки. */
export const isTurnoverAssumed = (form: LocationForm): boolean => num(form, 'turnover') === ASSUMED_TURNOVER

function presetStaffRows(params: ParameterIndex): readonly StaffGroupRow[] {
  return STAFF_PRESETS.map((p) => ({
    key: p.headcountCode,
    role: p.role,
    headcount: baseText(params, p.headcountCode),
    salary: baseText(params, p.salaryCode),
    preset: true,
  }))
}

export interface ProfileText {
  readonly name: string
  readonly city: string
  readonly address: string
}

/** Форма на значениях датасета склада — демо-профиль, как на 09а (D-31); тексты — из макета. */
export function buildInitialForm(params: ParameterIndex, profile: ProfileText): LocationForm {
  const numeric = Object.fromEntries(
    NUMERIC_KEYS.map((key) => [key, key === 'turnover' ? String(ASSUMED_TURNOVER) : baseText(params, NUMERIC_SPECS[key].code)]),
  ) as unknown as NumericValues
  return { facilityType: 'warehouse', ...profile, ...numeric, staff: presetStaffRows(params) }
}

/** Новая пустая группа: ключ не повторяет существующие, даже после удалений. */
export function addStaffRow(staff: readonly StaffGroupRow[]): readonly StaffGroupRow[] {
  const used = staff.map((r) => Number(/^custom-(\d+)$/.exec(r.key)?.[1] ?? 0))
  const next = Math.max(0, ...used) + 1
  return [...staff, { key: `custom-${String(next)}`, role: '', headcount: '', salary: '', preset: false }]
}

export function updateStaffRow(staff: readonly StaffGroupRow[], key: string, patch: Partial<Omit<StaffGroupRow, 'key' | 'preset'>>): readonly StaffGroupRow[] {
  return staff.map((r) => (r.key === key ? { ...r, ...patch } : r))
}

export const removeStaffRow = (staff: readonly StaffGroupRow[], key: string): readonly StaffGroupRow[] => staff.filter((r) => r.key !== key)

/** Черновик из браузера годится, если у него форма той же версии. */
export function isLocationForm(value: unknown): value is LocationForm {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<LocationForm>
  return (
    typeof v.facilityType === 'string' &&
    FACILITY_CHOICES.includes(v.facilityType) &&
    typeof v.name === 'string' &&
    Array.isArray(v.staff) &&
    NUMERIC_KEYS.every((key) => typeof v[key] === 'string')
  )
}

/** Состояние навигации с готовой формой: сценарий «14» в /dev/screens открывает форму ровно как на макете. */
export interface LocationNewNavState {
  readonly draft: LocationForm
}

export const locationNewState = (draft: LocationForm): LocationNewNavState => ({ draft })

export function draftFromNavState(state: unknown): LocationForm | null {
  if (typeof state !== 'object' || state === null || !('draft' in state)) return null
  return isLocationForm(state.draft) ? state.draft : null
}

/** id контрола поля — цель перехода «Ошибки →» на панели готовности. */
export const fieldDomId = (key: string): string => `location-${key.replaceAll(':', '-')}`
