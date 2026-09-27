import type { FacilityTypeCode } from '@/domain'

/** Группа исполнителей и параметры датасета с её численностью и окладом; у упаковщиков оклада в датасете нет. */
export interface StaffParameterGroup {
  readonly role: string
  readonly headcount: string
  readonly salary: string | null
}

/** Группы склада из датасета (приложение А): форма процесса 09а и карточка процесса 11. */
export const WAREHOUSE_STAFF: readonly StaffParameterGroup[] = [
  { role: 'Операторы погрузчиков', headcount: 'wh_forklift_operators', salary: 'wh_forklift_salary' },
  { role: 'Отборщики (комплектовщики)', headcount: 'wh_pickers', salary: 'wh_picker_salary' },
  { role: 'Операторы упаковочных линий', headcount: 'wh_packing_operators', salary: null },
]

/** В датасетах аэропорта и медучреждения численность дана по службам, а не по группам процессов. */
export const STAFF_PARAMETERS: Readonly<Record<FacilityTypeCode, readonly StaffParameterGroup[]>> = {
  warehouse: WAREHOUSE_STAFF,
  airport: [],
  medical: [],
}

/** Параметры профиля локации, которые нужны карточке процесса. */
export const PEAK_FACTOR_PARAMETER: Readonly<Record<FacilityTypeCode, string | null>> = {
  warehouse: 'wh_peak_factor',
  airport: null,
  medical: null,
}

export const PAYROLL_COEF_PARAMETER: Readonly<Record<FacilityTypeCode, string>> = {
  warehouse: 'wh_payroll_tax_coef',
  airport: 'ap_payroll_tax_coef',
  medical: 'med_payroll_tax_coef',
}
