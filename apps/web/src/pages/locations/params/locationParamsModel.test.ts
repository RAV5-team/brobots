import { describe, expect, it } from 'vitest'
import type { Location } from '@/domain'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { readiness, validateLocation } from '../new/locationCheck'
import { indexParameters, updateStaffRow } from '../new/locationForm'
import { formFromLocation, toLocationUpdate } from './locationParamsModel'
import { siteValuesFromLocation } from './siteProfileFields'

const params = indexParameters(FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse'))
const byId = (id: string): Location => {
  const found = LOCATIONS.find((l) => l.id === id)
  if (!found) throw new Error(`нет фикстуры ${id}`)
  return found
}
const khimki = byId('LOC-01')
const darkstore = byId('LOC-02')
const airport = byId('LOC-03')
const digits = (value: string) => value.replace(/\s/g, '')

describe('formFromLocation', () => {
  it('fills the form from the saved profile of РЦ Химки', () => {
    const form = formFromLocation(khimki, params)

    expect(form).toMatchObject({ facilityType: 'warehouse', name: 'РЦ Химки', city: 'Москва', address: 'Москва, Ленинградское ш., 12' })
    expect([form.totalArea, form.activeArea, form.shifts, form.shiftHours, form.peakFactor].map(digits)).toEqual(['20000', '10000', '2', '11', '1,5'])
    expect(form.turnover).toBe('0')
  })

  it('takes staff groups from dataset parameters when the profile has no groups (упаковщики без оклада, PRD 15 · №48)', () => {
    const form = formFromLocation(khimki, params)
    expect(form.staff.map((r) => [r.key, r.headcount, digits(r.salary), r.preset])).toEqual([
      ['wh_pickers', '100', '100000', true],
      ['wh_forklift_operators', '25', '120000', true],
      ['wh_packing_operators', '20', '', true],
    ])
  })

  it('takes staff groups from the profile and keeps preset rows recognisable', () => {
    const form = formFromLocation(darkstore, params)
    expect(form.staff.map((r) => [r.key, r.role, r.headcount, digits(r.salary)])).toEqual([
      ['wh_pickers', 'Отборщики (комплектовщики)', '30', '85000'],
      ['wh_forklift_operators', 'Операторы погрузчиков', '9', '95000'],
      ['wh_packing_operators', 'Операторы упаковочных линий', '8', ''],
    ])
  })

  it('passes a clean check: 9 / 9 required, no errors, one assumption', () => {
    const form = formFromLocation(khimki, params)
    const errors = validateLocation(form, params, { showRequired: true })
    expect(errors).toEqual({})
    expect(readiness(form, errors, params)).toMatchObject({ requiredDone: 9, requiredTotal: 9, errors: 0, assumptions: 1 })
  })

  it('keeps the facility type of a non-warehouse location', () => {
    expect(formFromLocation(airport, params)).toMatchObject({ facilityType: 'airport', name: 'Терминал Внуково-2' })
  })
})

describe('toLocationUpdate', () => {
  it('keeps parameters outside the form and the source of unchanged values', () => {
    const update = toLocationUpdate(formFromLocation(khimki, params), params, khimki)

    expect(update.parameters.wh_ceiling_height).toEqual({ value: 10, source: 'organizer' })
    expect(update.parameters.wh_total_area).toEqual({ value: 20000, source: 'organizer' })
    expect(update.parameters.wh_annual_turnover).toEqual({ value: 0, source: 'assumption' })
    expect(update).toMatchObject({ capexBudgetRub: khimki.capexBudgetRub, horizonYears: khimki.horizonYears, facilityType: 'warehouse' })
  })

  it('marks changed values as entered by the user and drops cleared optional fields', () => {
    const form = { ...formFromLocation(khimki, params), activeArea: '12 000', floors: '' }
    const update = toLocationUpdate(form, params, khimki)

    expect(update.parameters.wh_active_area).toEqual({ value: 12000, source: 'user' })
    expect(update.parameters).not.toHaveProperty('wh_floors')
  })

  it('saves staff groups; dataset staff codes stay out of parameters', () => {
    const base = formFromLocation(khimki, params)
    const form = { ...base, staff: updateStaffRow(base.staff, 'wh_packing_operators', { salary: '90 000' }) }
    const update = toLocationUpdate(form, params, khimki)

    expect(update.staffGroups).toContainEqual({ role: 'Операторы упаковочных линий', headcount: 20, salaryGrossMonthRub: 90000 })
    expect(update.parameters).not.toHaveProperty('wh_pickers')
  })

  it('saves a changed main aisle width without dropping the rest of the dataset profile', () => {
    const site = { ...siteValuesFromLocation(khimki), wh_main_aisle_width: '4' }
    const update = toLocationUpdate(formFromLocation(khimki, params), params, khimki, site)
    expect(update.parameters.wh_main_aisle_width).toEqual({ value: 4, source: 'user' })
    expect(update.parameters.wh_ceiling_height).toEqual({ value: 10, source: 'organizer' })
  })

  it('writes filled site_* values and drops empty ones (PRD 10.5)', () => {
    const site = { ...siteValuesFromLocation(khimki), site_wifi_coverage: 'частично', site_aisle_min_m: '2,8' }
    const update = toLocationUpdate(formFromLocation(khimki, params), params, khimki, site)

    expect(update.parameters.site_wifi_coverage).toEqual({ value: 'частично', source: 'user' })
    expect(update.parameters.site_aisle_min_m).toEqual({ value: 2.8, source: 'user' })
    expect(update.parameters).not.toHaveProperty('site_floor_load_tm2')
  })

  it('changes only the basics of a non-warehouse location', () => {
    const form = { ...formFromLocation(airport, params), name: 'Внуково-2 · терминал' }
    const update = toLocationUpdate(form, params, airport)

    expect(update).toMatchObject({ name: 'Внуково-2 · терминал', facilityType: 'airport' })
    expect(update.parameters).toEqual(airport.parameters)
    expect(update.staffGroups).toEqual(airport.staffGroups)
  })
})
