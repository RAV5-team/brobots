import { describe, expect, it } from 'vitest'
import type { Location, LocationProcess, Process } from '@/domain'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { countChanged, copyValues, formOf, siteBase, siteHints, siteValues, toLocationUpdate } from './locationProcessForm'

const find = <T,>(items: readonly T[], match: (item: T) => boolean): T => {
  const item = items.find(match)
  if (item === undefined) throw new Error('нет в фикстурах')
  return item
}

const khimki = find(LOCATIONS, (l) => l.id === 'LOC-01')
const pallets = find(PROCESSES, (p) => p.code === 'PR-0001')
const picking = find(PROCESSES, (p) => p.code === 'PR-0002')
const parameters = FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse')
const lp01 = find(LOCATION_PROCESSES, (lp) => lp.id === 'LP-01')

function forms(process: Process, lp: LocationProcess, location: Location = khimki) {
  const ctx = { defaults: PROCESS_TEMPLATE_DEFAULTS, process, location, parameters, operationClass: OPERATION_CLASSES.find((c) => c.code === process.operationClass) }
  const site = siteValues(ctx)
  return { site: formOf(site, ctx), copy: formOf(copyValues(site, lp), ctx) }
}

describe('siteValues + formOf (экран 16, PRD 10.4)', () => {
  it('fills the copy of «Перемещение паллет» from the template and the РЦ Химки profile', () => {
    const { copy } = forms(pallets, lp01)
    expect(copy).toMatchObject({
      operationClass: 'OP-01',
      name: 'Перемещение паллет',
      category: 'warehouse:internal_logistics',
      carrier: 'Паллета на полу',
      route: 'Приёмка → зона хранения → отгрузка',
      handling: ['forks', 'platform'],
      unitMassKg: '800',
      workHours: '22',
      peakFactor: '1,5',
      automationPct: '95',
      routeLengthM: '100',
      minAisleWidthM: '2,8',
      fleetSalaryRub: '120 000',
    })
    expect(copy.staff[0]).toMatchObject({ role: 'Операторы погрузчиков', headcount: 25, salaryRub: 120_000, selected: true, timeSharePct: '100' })
    expect(copy.staff.slice(1).every((row) => !row.selected)).toBe(true)
  })

  it('takes work hours from the location shifts, not from the template (= 2 смены × 11 ч)', () => {
    const shorter: Location = { ...khimki, parameters: { ...khimki.parameters, wh_shift_hours: { value: 8, source: 'user' } } }
    expect(forms(pallets, lp01, shorter).copy.workHours).toBe('16')
  })

  it('applies the overrides of the copy over the profile', () => {
    const lp: LocationProcess = { ...lp01, name: 'Паллеты · ночь', overrides: { dailyVolume: 1500 }, templateOverrides: { speedLimitMps: 1.2 } }
    expect(forms(pallets, lp).copy).toMatchObject({ name: 'Паллеты · ночь', dailyVolume: '1 500', speedLimitMps: '1,2' })
  })
})

describe('toLocationUpdate', () => {
  it('stores nothing but workers when nothing changed', () => {
    const { site, copy } = forms(pallets, lp01)
    expect(toLocationUpdate(copy, site, pallets)).toEqual({
      name: null,
      overrides: {},
      templateOverrides: {},
      handling: undefined,
      workers: [{ role: 'Операторы погрузчиков', timeShare: 1 }],
    })
    expect(countChanged(copy, site)).toBe(0)
  })

  it('stores only the values that differ from the template with the profile', () => {
    const { site, copy } = forms(pallets, lp01)
    const edited = { ...copy, name: 'Перемещение паллет · кросс-докинг', dailyVolume: '2 400', speedLimitMps: '1,2', replacement: { ...copy.replacement, forks: '0,75' } }
    const update = toLocationUpdate(edited, site, pallets)
    expect(update.name).toBe('Перемещение паллет · кросс-докинг')
    expect(update.overrides).toEqual({ dailyVolume: 2400 })
    expect(update.templateOverrides).toEqual({ speedLimitMps: 1.2 })
    expect(update.handling).toEqual([{ method: 'forks', laborReplacementRatio: 0.75 }, { method: 'platform', laborReplacementRatio: 0.6 }])
    expect(countChanged(edited, site)).toBe(4)
  })

  it('never carries the operation class: it is inherited from the template', () => {
    const { site, copy } = forms(pallets, lp01)
    expect(toLocationUpdate({ ...copy, operationClass: 'OP-02' }, site, pallets)).not.toHaveProperty('operationClass')
  })
})

describe('siteHints', () => {
  it('shows the formulas of the profile for «Перемещение паллет»', () => {
    const { site } = forms(pallets, lp01)
    const hints = siteHints(siteBase(khimki, parameters), site)
    expect(hints.workHours?.replace(/\u00a0/g, ' ')).toBe('= 2 смены × 11 ч (из локации)')
    expect(hints.dailyVolume).toContain('приёмка 1 000 + отгрузка 1 000')
    expect(hints.fleetSalaryRub).toBe('= оклад: операторы погрузчиков')
  })

  it('hides formulas that did not produce the value (комплектация: объём не из паллет)', () => {
    const lp = find(LOCATION_PROCESSES, (l) => l.id === 'LP-02')
    const { site } = forms(picking, lp)
    const hints = siteHints(siteBase(khimki, parameters), site)
    expect(hints.dailyVolume).toBeUndefined()
    expect(hints.routeLengthM).toBeUndefined()
    expect(hints.workHours).toBeDefined()
  })

  it('has no profile formulas for airports and hospitals yet', () => {
    const airport = find(LOCATIONS, (l) => l.facilityType === 'airport')
    expect(siteBase(airport, FACILITY_PARAMETERS.filter((p) => p.facilityType === 'airport'))).toBeNull()
  })
})
