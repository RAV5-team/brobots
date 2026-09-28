import { describe, expect, it } from 'vitest'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { readiness, toNewLocation, validateLocation } from './locationCheck'
import {
  addStaffRow,
  buildInitialForm,
  indexParameters,
  isLocationForm,
  removeStaffRow,
  updateStaffRow,
  type LocationForm,
} from './locationForm'
import { LOCATION_DEMO_PROFILE } from '@/mocks/fixtures/locationDemo'
import { mockupForm } from '@/pages/dev/locationMockup'

const params = indexParameters(FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse'))
const initial = buildInitialForm(params, LOCATION_DEMO_PROFILE)
const live = { showRequired: false }
const submit = { showRequired: true }

const check = (form: LocationForm) => {
  const errors = validateLocation(form, params, live)
  return { errors, ready: readiness(form, errors, params) }
}

describe('buildInitialForm', () => {
  it('fills the warehouse demo profile from the dataset and the mockup texts', () => {
    expect(initial).toMatchObject({ facilityType: 'warehouse', name: 'РЦ Химки', city: 'Москва', shifts: '2', peakFactor: '1,5', turnover: '0' })
    expect(initial.totalArea.replace(/\s/g, '')).toBe('20000')
    expect(initial.staff.map((r) => [r.role, r.headcount, r.salary.replace(/\s/g, '')])).toEqual([
      ['Отборщики (комплектовщики)', '100', '100000'],
      ['Операторы погрузчиков', '25', '120000'],
      ['Операторы упаковочных линий', '20', ''],
    ])
  })
})

describe('readiness', () => {
  it('counts 9 required and 16 fields on a valid warehouse profile', () => {
    const { errors, ready } = check(initial)
    expect(errors).toEqual({})
    expect(ready).toEqual({ requiredDone: 9, requiredTotal: 9, filled: 16, filledTotal: 16, errors: 0, assumptions: 1, optionalEmpty: 0 })
  })

  it('does not count a filled required field with an error as done (PRD 15 · №44)', () => {
    const { errors, ready } = check(mockupForm(initial))
    expect(Object.keys(errors)).toEqual(['activeArea'])
    expect(errors.activeArea?.replace(/\s/g, ' ')).toBe('Больше общей площади склада — 20 000 м²')
    expect(ready).toMatchObject({ requiredDone: 8, requiredTotal: 9, filled: 16, errors: 1 })
  })

  it('counts empty optional fields and drops the assumption once turnover is real data', () => {
    const { ready } = check({ ...initial, address: '', floors: '', turnover: '12' })
    expect(ready).toMatchObject({ optionalEmpty: 2, assumptions: 0, filled: 14 })
  })

  it('shows empty required fields as errors only after a save attempt', () => {
    const form = { ...initial, name: '  ' }
    expect(validateLocation(form, params, live).name).toBeUndefined()
    expect(validateLocation(form, params, submit).name).toBe('Заполните поле')
    expect(check(form).ready.requiredDone).toBe(8)
  })

  it('counts only the basics for types without drawn sections (D-36)', () => {
    const { ready } = check({ ...initial, facilityType: 'airport', totalArea: 'abc' })
    expect(ready).toEqual({ requiredDone: 3, requiredTotal: 3, filled: 4, filledTotal: 4, errors: 0, assumptions: 0, optionalEmpty: 0 })
  })
})

describe('validateLocation', () => {
  it('checks numbers, integers and dataset ranges', () => {
    const errors = validateLocation({ ...initial, shifts: '2,5', shiftHours: '14', peakFactor: 'много' }, params, live)
    expect(errors).toMatchObject({ shifts: 'Введите целое число', shiftHours: 'Допустимо от 10 до 11', peakFactor: 'Введите число: например, 1,5' })
  })

  it('requires at least one group with headcount and salary', () => {
    const staff = initial.staff.map((r) => ({ ...r, salary: '' }))
    expect(validateLocation({ ...initial, staff }, params, live).staff).toBe('Добавьте хотя бы одну группу с численностью и окладом')
  })

  it('lists errors in the on-screen order: basics, area, table, fields under the table', () => {
    const staff = updateStaffRow(initial.staff, 'wh_pickers', { headcount: '0' })
    const form = { ...initial, city: '', workTimeLoss: '90', floors: '9', staff }
    expect(Object.keys(validateLocation(form, params, submit))).toEqual(['city', 'floors', 'staff:wh_pickers:headcount', 'workTimeLoss'])
  })
})

describe('staff rows', () => {
  it('adds custom rows with unique keys and removes them by key', () => {
    const one = addStaffRow(initial.staff)
    const two = addStaffRow(removeStaffRow(addStaffRow(one), 'custom-2'))
    expect(two.map((r) => r.key).slice(3)).toEqual(['custom-1', 'custom-2'])
    expect(validateLocation({ ...initial, staff: one }, params, submit)).toMatchObject({
      'staff:custom-1:role': 'Заполните поле',
      'staff:custom-1:headcount': 'Заполните поле',
    })
  })
})

describe('toNewLocation', () => {
  it('saves the profile as warehouse parameters with sources and staff groups', () => {
    const created = toNewLocation(initial, params)
    expect(created).toMatchObject({ name: 'РЦ Химки', facilityType: 'warehouse', capexBudgetRub: 80_000_000, horizonYears: 5 })
    expect(created.parameters.wh_total_area).toEqual({ value: 20000, source: 'user' })
    expect(created.parameters.wh_annual_turnover).toEqual({ value: 0, source: 'assumption' })
    expect(created.parameters.wh_payroll_tax_coef).toEqual({ value: 1.302, source: 'organizer' })
    expect(created.parameters.wh_packing_operators).toEqual({ value: 20, source: 'user' })
    expect(created.staffGroups).toEqual([
      { role: 'Отборщики (комплектовщики)', headcount: 100, salaryGrossMonthRub: 100000 },
      { role: 'Операторы погрузчиков', headcount: 25, salaryGrossMonthRub: 120000 },
      { role: 'Операторы упаковочных линий', headcount: 20, salaryGrossMonthRub: null },
    ])
  })
})

describe('isLocationForm', () => {
  it('accepts the current form and rejects foreign drafts', () => {
    expect(isLocationForm(JSON.parse(JSON.stringify(initial)))).toBe(true)
    expect(isLocationForm({ ...initial, facilityType: 'factory' })).toBe(false)
    expect(isLocationForm({ name: 'x' })).toBe(false)
  })
})
