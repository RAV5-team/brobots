import type { Location, NewLocation, ParameterValue } from '@/domain'
import { formatNumber } from '@/shared/format'
import { toNewLocation } from '../new/locationCheck'
import {
  ASSUMED_TURNOVER,
  NUMERIC_KEYS,
  NUMERIC_SPECS,
  STAFF_PRESETS,
  buildInitialForm,
  numericValues,
  type LocationForm,
  type ParameterIndex,
  type StaffGroupRow,
} from '../new/locationForm'

/** Значение профиля строкой формы; нет в профиле — база датасета (domain: Location.parameters). */
function valueText(location: Location, params: ParameterIndex, code: string | null): string {
  if (code === null) return ''
  const own = location.parameters[code]?.value
  const base = params.get(code)?.base
  const value = own ?? base
  return typeof value === 'number' ? formatNumber(value, 3) : ''
}

/** Группы профиля; стандартные группы датасета узнаются по роли — у них ключ параметра, как на форме 14. */
function staffFromGroups(location: Location): readonly StaffGroupRow[] {
  return location.staffGroups.map((group, index) => {
    const preset = STAFF_PRESETS.find((p) => p.role === group.role)
    return {
      key: preset?.headcountCode ?? `custom-${String(index + 1)}`,
      role: group.role,
      headcount: formatNumber(group.headcount, 3),
      salary: group.salaryGrossMonthRub === null ? '' : formatNumber(group.salaryGrossMonthRub, 3),
      preset: preset !== undefined,
    }
  })
}

/** Групп в профиле нет (демо РЦ Химки) — стандартные группы из параметров датасета; у упаковщиков оклада нет (PRD 15 · №48). */
function staffFromParameters(location: Location, params: ParameterIndex): readonly StaffGroupRow[] {
  return STAFF_PRESETS.map((p) => ({
    key: p.headcountCode,
    role: p.role,
    headcount: valueText(location, params, p.headcountCode),
    salary: valueText(location, params, p.salaryCode),
    preset: true,
  }))
}

/**
 * Форма вкладки «Параметры объекта» из сохранённой локации (PRD 10.3: те же секции, что у формы 14).
 * Текучести нет ни в профиле, ни в датасете — принятый 0, как на форме 14 (допущение).
 */
export function formFromLocation(location: Location, params: ParameterIndex): LocationForm {
  const base = buildInitialForm(params, { name: location.name, city: location.city, address: location.address })
  const numeric = numericValues((key) => {
    const text = valueText(location, params, NUMERIC_SPECS[key].code)
    return key === 'turnover' && text === '' ? String(ASSUMED_TURNOVER) : text
  })
  const staff = location.staffGroups.length > 0 ? staffFromGroups(location) : staffFromParameters(location, params)
  return { ...base, ...numeric, facilityType: location.facilityType, staff }
}

/** Коды, которыми управляет форма: числовые поля и параметры стандартных групп. */
const FORM_CODES: ReadonlySet<string> = new Set([
  ...NUMERIC_KEYS.map((key) => NUMERIC_SPECS[key].code),
  ...STAFF_PRESETS.flatMap((p) => (p.salaryCode === null ? [p.headcountCode] : [p.headcountCode, p.salaryCode])),
])

/** Неизменённое значение сохраняет прежний источник («датасет», «допущение»); изменённое — ввод пользователя. */
function keepSource(code: string, next: ParameterValue, location: Location): ParameterValue {
  const prev = location.parameters[code]
  return prev?.value === next.value ? prev : next
}

/**
 * Локация для `updateLocation`. Параметры вне формы (проходы, покрытие, мощность…) остаются как были;
 * очищенное необязательное поле удаляется из профиля. Бюджет и горизонт не меняются — они в параметрах проекта.
 * У аэропорта и медучреждения разделов нет (D-36) — меняется только «Основное».
 */
export function toLocationUpdate(form: LocationForm, params: ParameterIndex, location: Location): NewLocation {
  const basics = { name: form.name.trim(), city: form.city.trim(), address: form.address.trim() }
  const kept: NewLocation = {
    name: location.name,
    city: location.city,
    address: location.address,
    facilityType: location.facilityType,
    capexBudgetRub: location.capexBudgetRub,
    horizonYears: location.horizonYears,
    parameters: location.parameters,
    staffGroups: location.staffGroups,
  }
  if (location.facilityType !== 'warehouse') return { ...kept, ...basics }

  const fromForm = toNewLocation(form, params)
  const outside = Object.entries(location.parameters).filter(([code]) => !FORM_CODES.has(code))
  const edited = Object.entries(fromForm.parameters).map(([code, value]): [string, ParameterValue] => [code, keepSource(code, value, location)])
  return { ...kept, ...basics, parameters: Object.fromEntries([...outside, ...edited]), staffGroups: fromForm.staffGroups }
}
