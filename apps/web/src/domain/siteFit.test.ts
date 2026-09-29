import { describe, expect, it } from 'vitest'
import type { Location } from './location'
import type { RobotSpecs } from './robot'
import {
  aisleFit, cargoFit, needsCheckCount, siteFactsOf, siteFactsOfLocation, siteRequirementChecks, temperatureFit, type SiteFacts,
} from './siteFit'

const location = (parameters: Location['parameters']): Location => ({
  id: 'LOC-01', name: 'РЦ Химки', facilityType: 'warehouse', city: '', address: '', capexBudgetRub: 0, horizonYears: 5,
  parameters, staffGroups: [], updatedAt: '2026-09-14T00:00:00.000Z',
})
const HIMKI = location({ wh_pallet_mass: { value: 800, source: 'organizer' }, wh_rack_aisle_width: { value: 3, source: 'organizer' } })
const specs = (patch: Partial<RobotSpecs>): RobotSpecs => ({ confidence: 'partial', ...patch })
const AMR800 = specs({ payloadKg: 800, widthMm: 640, minTempC: 5 })

describe('правило «робот × площадка» (К-3, 2.1а, D-99)', () => {
  it('груз: масса единицы не больше грузоподъёмности; нет данных — «?»', () => {
    expect(cargoFit(800, 800)).toBe('fit')
    expect(cargoFit(800, 100)).toBe('misfit')
    expect(cargoFit(null, 800)).toBe('unknown')
    expect(cargoFit(800, undefined)).toBe('unknown')
  })

  it('проходы: ширина робота + запас не больше прохода', () => {
    expect(aisleFit(2.8, 2.1, 0.6)).toBe('fit')
    expect(aisleFit(2.8, 2.4, 0.6)).toBe('misfit')
    expect(aisleFit(null, 0.64, 0.6)).toBe('unknown')
  })

  it('температура: сверяются только указанные границы робота; нет ни одной — «?»', () => {
    expect(temperatureFit({ min: 5, max: 25 }, { minTempC: 5 })).toBe('fit')
    expect(temperatureFit({ min: 0, max: 25 }, { minTempC: 5 })).toBe('misfit')
    expect(temperatureFit({ min: 5, max: 40 }, { minTempC: -10, maxTempC: 35 })).toBe('misfit')
    expect(temperatureFit({ min: 5, max: 25 }, {})).toBe('unknown')
    expect(temperatureFit(null, { minTempC: 5 })).toBe('unknown')
  })

  it('профиль склада К-3: температуры, пола и Wi-Fi нет — как было в сравнении', () => {
    expect(siteFactsOfLocation(HIMKI)).toEqual({ unitMassKg: 800, aisleWidthM: 3, temperatureC: null, floorLoadTm2: null, wifiCoverage: null })
  })

  it('проект: проход — мин. на маршруте, температура и пол — из параметров площадки', () => {
    const facts = siteFactsOf(HIMKI, {
      site_aisle_min_m: { value: 2.8, source: 'organizer' },
      site_temp_min_c: { value: 5, source: 'user' },
      site_temp_max_c: { value: 25, source: 'user' },
    })
    expect(facts).toEqual({ unitMassKg: 800, aisleWidthM: 2.8, temperatureC: { min: 5, max: 25 }, floorLoadTm2: null, wifiCoverage: null })
  })

  it('AMR 800 на РЦ Химки: подтверждены груз, проходы, температура; нагрузка на пол и Wi-Fi требуют проверки', () => {
    const site: SiteFacts = { unitMassKg: 800, aisleWidthM: 2.8, temperatureC: { min: 5, max: 25 }, floorLoadTm2: null, wifiCoverage: null }
    const checks = siteRequirementChecks(AMR800, site, 0.6)
    expect(checks.map((c) => [c.key, c.status])).toEqual([
      ['cargo', 'confirmed'], ['aisles', 'confirmed'], ['temperature', 'confirmed'], ['floorLoad', 'needs_check'], ['connectivity', 'needs_check'],
    ])
    expect(needsCheckCount(checks)).toBe(2)
    expect(checks[0]).toEqual({
      key: 'cargo', status: 'confirmed',
      requirement: { kind: 'number', value: 800, unit: 'kg' }, locationValue: { kind: 'number', value: 800, unit: 'kg' },
    })
    expect(checks[1]?.requirement).toEqual({ kind: 'number', value: 1.24, unit: 'm' })
    expect(checks[2]?.requirement).toEqual({ kind: 'range', min: 5, max: null, unit: 'celsius' })
  })

  it('данные площадки о поле и Wi-Fi есть — требование принято; тяжёлый груз — не подходит', () => {
    const site: SiteFacts = { unitMassKg: 1000, aisleWidthM: 2.8, temperatureC: null, floorLoadTm2: 5, wifiCoverage: 'Есть, 5 ГГц' }
    const checks = siteRequirementChecks(AMR800, site, 0.6)
    expect(Object.fromEntries(checks.map((c) => [c.key, c.status]))).toEqual({
      cargo: 'misfit', aisles: 'confirmed', temperature: 'needs_check', floorLoad: 'confirmed', connectivity: 'confirmed',
    })
    expect(checks[4]?.locationValue).toEqual({ kind: 'text', text: 'Есть, 5 ГГц' })
  })
})
