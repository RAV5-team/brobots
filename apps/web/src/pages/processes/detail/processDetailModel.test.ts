import { describe, expect, it } from 'vitest'
import type { FacilityTypeCode, Location, Process, Robot } from '@/domain'
import { FACILITY_PARAMETERS, FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import {
  capitalize,
  catalogHref,
  facilityNames,
  locationUsages,
  newProjectHref,
  robotCard,
  robotSummary,
  routeSegments,
  shortManufacturer,
} from './processDetailModel'
import { processRequirements } from './processRequirements.mock'

const process = (code: string): Process => {
  const found = PROCESSES.find((p) => p.code === code)
  if (!found) throw new Error(code)
  return found
}
const robot = (name: string): Robot => {
  const found = ROBOTS.find((r) => r.name === name)
  if (!found) throw new Error(name)
  return found
}
const parameters = Object.fromEntries(
  (['warehouse', 'airport', 'medical'] as FacilityTypeCode[]).map((t) => [t, FACILITY_PARAMETERS.filter((p) => p.facilityType === t)]),
)
const usagesOf = (p: Process, locations: readonly Location[] = LOCATIONS) =>
  locationUsages({ process: p, locations, locationProcesses: LOCATION_PROCESSES, facilityTypes: FACILITY_TYPES, parameters })
const rowsOf = (usage: { rows: readonly { label: string; value: string }[] } | undefined) =>
  Object.fromEntries((usage?.rows ?? []).map((r) => [r.label, r.value.replace(/\s/gu, ' ')]))

describe('processDetailModel (экран 11)', () => {
  it('names facility types and capitalizes the carrier', () => {
    expect(facilityNames(process('PR-0004'), FACILITY_TYPES)).toEqual(['Склад', 'Аэропорт', 'Медучреждение'])
    expect(capitalize('паллета на полу')).toBe('Паллета на полу')
  })

  it('splits route points into segments', () => {
    expect(routeSegments(['Приёмка', 'Зона хранения', 'Отгрузка'])).toEqual([
      { from: 'Приёмка', to: 'Зона хранения' },
      { from: 'Зона хранения', to: 'Отгрузка' },
    ])
    expect(routeSegments(undefined)).toEqual([])
    expect(routeSegments(['Одна точка'])).toEqual([])
  })

  it('counts OP-01 robots by data confidence and features six, confirmed first (PRD 3.4)', () => {
    const op01 = ROBOTS.filter((r) => r.operationClasses.some((c) => c.code === 'OP-01'))
    const summary = robotSummary(op01)
    expect(summary.total).toBe(16)
    expect(summary.byConfidence).toEqual({ confirmed: 3, partial: 5, unconfirmed: 8 })
    expect(summary.featured).toHaveLength(6)
    expect(summary.featured.map((r) => r.specs.confidence)).toEqual(['confirmed', 'confirmed', 'confirmed', 'partial', 'partial', 'partial'])
  })

  it('shows robot cards with organizer TRL and compact price (PRD 15 · №52)', () => {
    const card = robotCard(robot('Ronavi M'))
    expect(card.vendor).toBe('Ронави Роботикс · AMR')
    expect(card.trl).toBe('УГТ 7')
    expect(card.price.replace(/\s/gu, ' ')).toBe('2,4 млн ₽')
    expect(robotCard({ ...robot('Ronavi M'), trl: null, priceRub: null })).toMatchObject({ trl: 'УГТ —', price: 'цена по запросу' })
    expect(shortManufacturer('АО «Когнитив Пилот»')).toBe('Когнитив Пилот')
    expect(shortManufacturer('Pudu Robotics')).toBe('Pudu Robotics')
  })

  it('computes pallet movement on RC Khimki from the dataset (PRD 9.3)', () => {
    const [khimki, darkstore] = usagesOf(process('PR-0001'))
    expect(khimki?.heading).toBe('РЦ Химки · Склад')
    expect(rowsOf(khimki)).toEqual({
      'Потребность': '2 000 паллет / сут',
      'Пиковая производительность': '136 паллет / ч',
      'Сейчас выполняют': '25 человек · Операторы погрузчиков',
      'Стоимость труда': '47 млн ₽/год',
      'Цель автоматизации': '95 % потока',
    })
    // Даркстор: 620 ÷ 22 × 1,5 = 42; группа из профиля локации — 9 × 95 000 ₽, а не оклад датасета.
    expect(rowsOf(darkstore)).toMatchObject({
      'Потребность': '620 паллет / сут',
      'Пиковая производительность': '42 паллет / ч',
      'Сейчас выполняют': '9 человек · Операторы погрузчиков',
      'Стоимость труда': '13 млн ₽/год',
    })
  })

  it('shows "нет данных" when the location has no headcount or salary for the role', () => {
    const [khimki] = LOCATIONS
    if (!khimki) throw new Error('no location')
    const noSalary = { ...khimki, staffGroups: [{ role: 'Операторы погрузчиков', headcount: 4, salaryGrossMonthRub: null }] }
    expect(rowsOf(usagesOf(process('PR-0001'), [noSalary])[0])['Стоимость труда']).toBe('нет данных')
    const airport = usagesOf(process('PR-0008'))[0]
    expect(rowsOf(airport)['Сейчас выполняют']).toBe('Персонал рампа')
    expect(rowsOf(airport)['Стоимость труда']).toBe('нет данных')
  })

  it('lists only locations where the process is used', () => {
    expect(usagesOf(process('PR-0001')).map((u) => u.locationId)).toEqual(['LOC-01', 'LOC-02'])
    expect(usagesOf(process('PR-0006'))).toEqual([])
  })

  it('builds links to a new project and to the catalog filtered by class', () => {
    expect(newProjectHref({ locationId: 'LOC-01', locationProcessId: 'LP-01' })).toBe('/projects?new=1&locationId=LOC-01&locationProcessId=LP-01')
    expect(catalogHref('OP-01')).toBe('/catalog?class=OP-01')
  })

  it('takes requirements from the mockup for pallets and derives them for other processes', () => {
    const pallets = processRequirements(process('PR-0001'), 'паллет / ч')
    expect(pallets.required.map((r) => r.label)).toEqual(['Объём потока', 'Максимальная масса', 'Тип паллеты', 'Ширина маршрута'])
    expect(pallets.desirable).toHaveLength(4)
    expect(pallets.environment).toHaveLength(5)
    const patrol = processRequirements(process('PR-0007'), 'обходов / сут')
    expect(patrol.required).toEqual([{ label: 'Объём потока', unit: 'обходов / сут' }, { label: 'Ширина маршрута', unit: 'м' }])
    expect(patrol.desirable.map((r) => r.label)).toEqual(['Средняя дистанция', 'Коэффициент пиковой нагрузки'])
  })
})
