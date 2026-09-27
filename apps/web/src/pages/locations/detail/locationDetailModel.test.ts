import { describe, expect, it } from 'vitest'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { PROJECTS } from '@/mocks/fixtures/projects'
import type { Location, LocationSummary } from '@/domain'
import { locationProcessViews, profileLine, readinessLabel, type LocationDetailData } from './locationDetailModel'

/** Форматтер ставит неразрывные пробелы в числах и перед единицами. */
const plain = (s: string | undefined) => s?.replace(/[\u00a0\u202f]/g, ' ')

const himki = LOCATIONS.find((l) => l.id === 'LOC-01') as Location

const summary: LocationSummary = {
  locationId: 'LOC-01',
  totalAreaM2: 20000,
  staffTotal: 180,
  shiftsPerDay: 2,
  shiftHours: 11,
  processesCount: 5,
  laborCostRubYear: null,
  workersInProcesses: null,
  parametersCompletenessPct: 100,
  assumptionsCount: 2,
  projectsCount: 2,
  projectsCompleted: 0,
}

const data: LocationDetailData = {
  location: himki,
  summary,
  facilityTypeName: 'Склад',
  facilityTypes: [{ code: 'warehouse', name: 'Склад' }],
  processes: PROCESSES,
  locationProcesses: LOCATION_PROCESSES.filter((lp) => lp.locationId === 'LOC-01'),
  operationClasses: OPERATION_CLASSES,
  robotsByClass: { 'OP-01': 7, 'OP-02': 3 },
  projects: PROJECTS,
  parameters: FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse'),
}

describe('profileLine', () => {
  it('собирает строку профиля как на макете 15', () => {
    expect(plain(profileLine(himki, summary))).toBe('Москва · 20 000 м² · 180 сотрудников · 2 смены × 11 ч')
  })

  it('пропускает неизвестные значения', () => {
    const empty = { ...summary, totalAreaM2: null, staffTotal: null, shiftsPerDay: null }
    expect(profileLine(himki, empty)).toBe('Москва')
  })
})

describe('locationProcessViews', () => {
  const views = locationProcessViews(data)
  const byId = (id: string) => views.find((v) => v.id === id)

  it('показывает все процессы локации по порядку (PRD 15 · №41)', () => {
    expect(views.map((v) => v.id)).toEqual(['LP-01', 'LP-02', 'LP-03', 'LP-04', 'LP-05'])
  })

  it('берёт название площадки, иначе шаблона', () => {
    expect(byId('LP-04')?.name).toBe('Уборка склада')
    expect(byId('LP-02')?.name).toBe('Комплектация заказов')
  })

  it('подставляет значения площадки поверх шаблона (PRD 15 · №40)', () => {
    expect(plain(byId('LP-03')?.rows.find((r) => r.key === 'volume')?.value)).toBe('833 заказов / сут')
  })

  it('отмечает процессы, которые входят в проекты локации', () => {
    expect(byId('LP-01')?.isSelected).toBe(true)
    expect(byId('LP-04')?.isSelected).toBe(true)
    expect(byId('LP-02')?.isSelected).toBe(false)
  })

  it('считает роботов по классу процесса', () => {
    expect(byId('LP-01')?.robotCount).toBe(7)
    expect(byId('LP-05')?.robotCount).toBe(0)
  })

  it('готовность: исполнители и оклад из датасета склада', () => {
    expect(byId('LP-01')?.missing).toEqual([])
    expect(byId('LP-02')?.missing).toEqual([])
  })

  it('упаковке не хватает оклада — его нет в профиле (PRD 15 · №48)', () => {
    expect(byId('LP-03')?.missing).toEqual(['salary'])
  })

  it('без исполнителей не хватает исполнителей и оклада', () => {
    expect(byId('LP-05')?.missing).toEqual(['workers', 'salary'])
  })

  it('без объёма не хватает объёма', () => {
    const noVolume = { ...data, locationProcesses: [{ ...LOCATION_PROCESSES[0], overrides: { dailyVolume: 0 } }] } as LocationDetailData
    expect(locationProcessViews(noVolume)[0]?.missing).toEqual(['volume'])
  })
})

describe('readinessLabel', () => {
  it('готово — 9/9', () => {
    expect(readinessLabel([])).toBe('Готово к расчёту · 9/9')
  })

  it('перечисляет недостающее', () => {
    expect(readinessLabel(['workers', 'salary'])).toBe('Не хватает 2: исполнители, оклад')
  })
})
