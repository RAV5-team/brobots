import { describe, expect, it } from 'vitest'
import type { Location, Robot } from '@/domain'
import { LAUNCH_ITEMS } from '@/mocks/fixtures/launchItems'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { buildCompareGroups, resolveEntries, siteFit, type CompareModelGroup, type CompareValue } from './compareModel'

const HIMKI = LOCATIONS.find((l) => l.id === 'LOC-01') as Location
const robot = (name: string) => ROBOTS.find((r) => r.name === name) as Robot
const valueText = (v: CompareValue | undefined) => (v === undefined ? undefined : v.kind === 'chips' ? v.items.join(', ') : v.text)
const cell = (groups: readonly CompareModelGroup[], row: string, col: number) =>
  groups.flatMap((g) => g.rows).find((r) => r.key === row)?.values[col]

const entries = resolveEntries(
  [{ kind: 'robot', id: 'RB-0007' }, { kind: 'robot', id: 'RB-0008' }, { kind: 'launch-item', id: 'SI-SW-01' }],
  ROBOTS, LAUNCH_ITEMS,
)
const CTX = { items: LAUNCH_ITEMS, robots: ROBOTS, operationClasses: OPERATION_CLASSES, processes: PROCESSES, facilityTypes: FACILITY_TYPES, catalogVersion: 'v4' }
const withLocation = buildCompareGroups(entries, { ...CTX, location: HIMKI })

describe('compareModel (К-3, PRD 7.6)', () => {
  it('keeps the order of the set and drops positions that left the catalog', () => {
    const resolved = resolveEntries([{ kind: 'robot', id: 'RB-9999' }, { kind: 'launch-item', id: 'SI-SW-01' }], ROBOTS, LAUNCH_ITEMS)
    expect(resolved.map((e) => e.kind)).toEqual(['launch-item'])
    expect(entries).toHaveLength(3)
  })

  it('builds the five groups of PRD 7.6, the fit block only with a location (D-58)', () => {
    expect(withLocation.map((g) => g.title)).toEqual([
      'Основное', 'Производительность', 'Требования к объекту', 'Качество данных', 'Соответствие · РЦ Химки',
    ])
    expect(buildCompareGroups(entries, { ...CTX, location: null })).toHaveLength(4)
  })

  it('fills robot rows from data and marks robot-only rows «не применимо» for a launch item', () => {
    expect(valueText(cell(withLocation, 'price', 0))).toBe('1,50 млн ₽')
    expect(valueText(cell(withLocation, 'role', 0))).toBe('Робот или система')
    expect(valueText(cell(withLocation, 'operationClasses', 1))).toBe('OP-01, OP-08')
    expect(valueText(cell(withLocation, 'region', 1))).toBe('Москва')
    expect(valueText(cell(withLocation, 'quantityNorm', 0))).toBe('не применимо')
    expect(valueText(cell(withLocation, 'trl', 2))).toBe('не применимо')
    expect(valueText(cell(withLocation, 'quantityNorm', 2))).toBe('1 лицензия на парк')
    expect(valueText(cell(withLocation, 'role', 2))).toBe('Обязательная часть конфигурации')
    expect(valueText(cell(withLocation, 'compatibility', 2))).toBe('AK-2000-2, Робот-штабелёр RoboCV')
  })

  it('greys missing and unconfirmed values (PRD 7.6, D-64)', () => {
    expect(cell(withLocation, 'minAisle', 0)).toEqual({ kind: 'text', text: 'нет данных', tone: 'unconfirmed' })
    // AMR 100: ТТХ «частично» — грузоподъёмность серая.
    expect(cell(withLocation, 'payload', 0)).toMatchObject({ kind: 'chips', tone: 'unconfirmed' })
    expect(cell(withLocation, 'confirmed', 2)).toEqual({ kind: 'text', text: '3 из 4', tone: 'unconfirmed' })
  })

  it('lists the whole required launch part of a robot on a panel, WMS included for AMR 800 (D-78)', () => {
    expect(cell(withLocation, 'launchInfrastructure', 1)).toEqual({
      kind: 'chips', items: ['Зарядная станция', 'Fleet Manager', 'Commissioning', 'WMS Connector'], tone: 'panel',
    })
  })

  it('checks cargo against the pallet mass of РЦ Химки: 800 kg (PRD 7.6)', () => {
    expect(siteFit(robot('AMR 100'), HIMKI).cargo).toEqual({ kind: 'fit', status: 'misfit', text: 'груз: 800 > 100 кг' })
    expect(siteFit(robot('AMR 800'), HIMKI).cargo).toEqual({ kind: 'fit', status: 'fit', text: 'груз: 800 ≤ 800 кг' })
    expect(siteFit(robot('AS-RS P'), HIMKI).cargo.kind === 'fit' && siteFit(robot('AS-RS P'), HIMKI).cargo).toMatchObject({ status: 'unknown' })
  })

  it('checks the aisle with a 0.5 m clearance and leaves temperature and floor load unknown (D-75)', () => {
    const fit = siteFit(robot('AMR 800'), HIMKI)
    expect(fit.aisles).toEqual({ kind: 'fit', status: 'fit', text: 'проход 2,8 м, робот 0,64 м' })
    expect(siteFit(robot('DMR Carrier P'), HIMKI).aisles).toMatchObject({ status: 'fit' })
    const wide: Robot = { ...robot('EVOCARGO N1'), specs: { ...robot('EVOCARGO N1').specs, widthMm: 2400 } }
    expect(siteFit(wide, HIMKI).aisles).toEqual({ kind: 'fit', status: 'misfit', text: 'проход 2,8 м узок для робота 2,4 м' })
    expect(siteFit(robot('AMR 100'), HIMKI).aisles).toMatchObject({ status: 'unknown', text: 'требование к проходу не указано' })
    expect(fit.temperature).toMatchObject({ status: 'unknown' })
    expect(fit.floorLoad).toMatchObject({ status: 'unknown', text: 'допустимая нагрузка на пол' })
    expect(valueText(cell(withLocation, 'cargo', 2))).toBe('не применимо')
  })
})
