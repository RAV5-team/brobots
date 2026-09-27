import { describe, expect, it } from 'vitest'
import { NORM_GROUPS, specsCompleteness } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { DATA_SOURCES } from './dataSources'
import { FACILITY_PARAMETERS } from './facilityParameters'
import { LOCATION_PROCESSES } from './locationProcesses'
import { LOCATIONS } from './locations'
import { NORMS } from './norms'
import { OPERATION_CLASSES } from './operationClasses'
import { PROCESSES } from './processes'
import { PROJECTS } from './projects'
import { ROBOTS } from './robots'

const base = (code: string) => {
  const parameter = FACILITY_PARAMETERS.find((p) => p.code === code)
  if (!parameter) throw new Error(`Нет параметра ${code}`)
  return parameter.base
}
const process = (code: string) => PROCESSES.find((p) => p.code === code)
const robot = (name: string) => ROBOTS.find((r) => r.name === name)
const location = (name: string) => LOCATIONS.find((l) => l.name === name)
const classCodes = new Set(OPERATION_CLASSES.map((c) => c.code))

describe('fixtures: integrity', () => {
  it('holds all 138 dataset parameters (42 / 39 / 57)', () => {
    const count = (t: string) => FACILITY_PARAMETERS.filter((p) => p.facilityType === t).length
    expect([FACILITY_PARAMETERS.length, count('warehouse'), count('airport'), count('medical')]).toEqual([138, 42, 39, 57])
    expect(new Set(FACILITY_PARAMETERS.map((p) => p.code)).size).toBe(138)
  })

  it('keeps every numeric base value inside its range', () => {
    const outside = FACILITY_PARAMETERS.filter(
      (p) => typeof p.base === 'number' && p.min !== null && p.max !== null && (p.base < p.min || p.base > p.max),
    )
    expect(outside.map((p) => p.code)).toEqual([])
  })

  it('has ten operation classes OP-01…OP-10', () => {
    expect([...classCodes]).toEqual(Array.from({ length: 10 }, (_, i) => `OP-${String(i + 1).padStart(2, '0')}`))
  })

  it('references only existing operation classes', () => {
    expect(PROCESSES.filter((p) => !classCodes.has(p.operationClass))).toEqual([])
    expect(ROBOTS.flatMap((r) => r.operationClasses).filter((c) => !classCodes.has(c.code))).toEqual([])
  })

  it('gives robots unique RB-NNNN ids', () => {
    expect(ROBOTS.every((r) => /^RB-\d{4}$/.test(r.id))).toBe(true)
    expect(new Set(ROBOTS.map((r) => r.id)).size).toBe(ROBOTS.length)
  })

  it('links location processes to existing locations and suitable processes', () => {
    for (const lp of LOCATION_PROCESSES) {
      const loc = LOCATIONS.find((l) => l.id === lp.locationId)
      const proc = process(lp.processCode)
      expect(loc, lp.id).toBeDefined()
      expect(proc?.facilityTypes, lp.id).toContain(loc?.facilityType)
    }
  })

  it('builds projects from processes of their own location', () => {
    for (const pj of PROJECTS) {
      const own = LOCATION_PROCESSES.filter((lp) => lp.locationId === pj.locationId).map((lp) => lp.id)
      expect(pj.locationProcessId === null || own.includes(pj.locationProcessId), pj.id).toBe(true)
    }
  })

  it('fills every location parameter of its facility type', () => {
    for (const loc of LOCATIONS) {
      const expected = FACILITY_PARAMETERS.filter(
        (p) => p.facilityType === loc.facilityType && !/_(capex_budget|horizon_years)$/.test(p.code),
      ).map((p) => p.code)
      expect(Object.keys(loc.parameters).sort(), loc.name).toEqual(expected.sort())
    }
  })
})

describe('fixtures: resolved PRD 15 discrepancies (README)', () => {
  it('№10: the norms reference has 34 rows in 6 groups, 12 norms and 22 assumptions (PRD 6.8, D-49)', () => {
    expect(NORMS).toHaveLength(34)
    expect(new Set(NORMS.map((n) => n.code)).size).toBe(34)
    const countOf = (group: string) => NORMS.filter((n) => n.group === group).length
    expect(Object.fromEntries(NORM_GROUPS.map((group) => [group, countOf(group)]))).toEqual({
      staff: 3, fleet: 5, capex: 7, opex: 7, finance: 8, interpretation: 4,
    })
    expect(NORMS.filter((n) => n.kind === 'norm')).toHaveLength(12)
  })

  it('№10: the norms source on А6 counts the same 34 rows as А5', () => {
    const norms = DATA_SOURCES.find((s) => s.kind === 'norms')
    expect(norms?.provides).toBe(formatCount(NORMS.length, ru.plural.norms))
  })

  it('№16: ТТХ completeness is counted from the eight А2 parameters (D-46)', () => {
    const amr800 = robot('AMR 800')
    expect(amr800?.specs).toMatchObject({ chargeTimeMin: 60, avgPowerKw: 1, loadTimeS: 45, unloadTimeS: 45 })
    expect(amr800 && specsCompleteness(amr800.specs)).toBe(1)
    expect(amr800?.updatedAt.startsWith('2026-09-19')).toBe(true)
  })

  it('№53: only DMR 600 and Сёмабот await confirmation (D-46)', () => {
    expect(ROBOTS.filter((r) => r.needsConfirmation).map((r) => r.name).sort()).toEqual(['DMR 600', 'Сёмабот'])
  })

  it('№37, №67: pallet mass is the dataset value 800 kg', () => {
    expect(base('wh_pallet_mass')).toBe(800)
    expect(process('PR-0001')?.defaults.unitMassKg).toBe(800)
  })

  it('№38: route length = √ active area of the dataset (100 m)', () => {
    expect(process('PR-0001')?.defaults.routeLengthM).toBe(Math.sqrt(Number(base('wh_active_area'))))
  })

  it('№39: automation share = 1 − oversize share (95 %)', () => {
    expect(process('PR-0001')?.defaults.automationShare).toBe(1 - Number(base('wh_oversize_share')) / 100)
  })

  it('№40: packing keeps 8 000 orders in the library and 833 on РЦ Химки', () => {
    const khimki = location('РЦ Химки')
    const packing = LOCATION_PROCESSES.find((lp) => lp.locationId === khimki?.id && lp.processCode === 'PR-0003')
    expect(process('PR-0003')?.defaults.dailyVolume).toBe(8000)
    expect(packing?.overrides.dailyVolume).toBe(833)
  })

  it('№41: РЦ Химки has five processes', () => {
    expect(LOCATION_PROCESSES.filter((lp) => lp.locationId === location('РЦ Химки')?.id)).toHaveLength(5)
  })

  it('№45: РЦ Химки has two assumptions in its profile, as on the form', () => {
    const params = Object.values(location('РЦ Химки')?.parameters ?? {})
    expect(params.filter((p) => p.source === 'assumption')).toHaveLength(2)
  })

  it('№7: portions per day use the dataset base 1 950', () => {
    expect(process('PR-0010')?.defaults.dailyVolume).toBe(base('med_portions_day'))
  })

  it('№15: Ronavi H1500 throughput uses the lower bound of 80–100', () => {
    expect(robot('Ronavi H1500')?.operationClasses[0]).toMatchObject({ productivityPerHour: 80, productivityText: '80–100 паллет/ч' })
  })

  it('№52: TRL comes from the organizer file', () => {
    expect([robot('Ronavi M')?.trl, robot('AMR 1500')?.trl]).toEqual([7, 8])
  })

  it('№9: DMR Carrier P is an FMR', () => {
    expect(robot('DMR Carrier P')?.subtype).toBe('FMR')
  })

  it('№57, №61: the Даркстор Юг project is a saved assessment (PRD 11.1)', () => {
    const project = PROJECTS.find((p) => p.locationId === location('Даркстор Юг')?.id)
    expect(project).toMatchObject({ status: 'saved', result: { capexRub: 52_400_000, paybackYears: 1.6 } })
  })

  it('№106: snapshots keep the new model values shown on the result, not the old A1 board', () => {
    const results = PROJECTS.flatMap((p) => (p.status === 'saved' ? [[p.id, p.result.capexRub, p.result.opexRubPerYear, p.result.paybackYears]] : []))
    expect(results).toEqual([
      ['PJ-01', 6_100_000, 42_000_000, 0.7],
      ['PJ-03', 52_400_000, 21_300_000, 1.6],
      ['PJ-05', 84_000_000, 12_500_000, 7],
      ['PJ-06', 47_400_000, 34_500_000, 2.8],
    ])
  })

  it('№65, №66: class codes and names follow the A8 reference', () => {
    expect(['PR-0002', 'PR-0003', 'PR-0005'].map((c) => process(c)?.operationClass)).toEqual(['OP-02', 'OP-05', 'OP-06'])
    expect(OPERATION_CLASSES[0]).toMatchObject({ code: 'OP-01', name: 'Перемещение грузов' })
  })

  it('outside PRD 15: baggage mass is the dataset value 18 kg', () => {
    expect(process('PR-0008')?.defaults.unitMassKg).toBe(base('ap_baggage_mass'))
  })
})
