import { describe, expect, it } from 'vitest'
import type { Process } from '@/domain'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { searchTemplates, templateOptions, type TemplateSources } from './templatePickerModel'

// formatCount ставит неразрывный пробел между числом и словом.
const plain = (s: string | undefined) => s?.replace(/\u00a0/g, ' ')

const khimki = (overrides: Partial<TemplateSources> = {}): TemplateSources => ({
  facilityType: 'warehouse',
  processes: PROCESSES,
  locationProcesses: LOCATION_PROCESSES.filter((lp) => lp.locationId === 'LOC-01'),
  operationClasses: OPERATION_CLASSES,
  robotsByClass: { 'OP-01': 4, 'OP-03': 10, 'OP-08': 0, 'OP-09': 1 },
  ...overrides,
})

describe('templateOptions (окно 15а, PRD 10.4)', () => {
  it('offers templates of the facility type first, then other types, then those already on the location', () => {
    const names = templateOptions(khimki()).map((o) => o.name)
    expect(names.slice(0, 2)).toEqual(['Сортировка грузов', 'Патрулирование и охрана'])
    expect(names.slice(2, 7)).toEqual([
      'Перемещение багажа', 'Доставка бортпитания', 'Доставка питания по отделениям', 'Транспорт белья', 'Доставка биоматериалов',
    ])
    expect(names.slice(7)).toEqual(['Перемещение паллет', 'Комплектация заказов', 'Упаковка', 'Уборка помещений', 'Инвентаризация'])
  })

  it('marks templates already on the location as unavailable — one template per location', () => {
    const options = templateOptions(khimki())
    expect(options.filter((o) => o.isOnLocation).map((o) => o.code)).toEqual(['PR-0001', 'PR-0002', 'PR-0003', 'PR-0004', 'PR-0005'])
  })

  it('describes a template by class and robot count with the right plural (PRD 15 · №50)', () => {
    const [sorting, patrol] = templateOptions(khimki())
    expect(plain(sorting?.details)).toBe('OP-03 Сортировка · 10 роботов')
    expect(plain(patrol?.details)).toBe('OP-09 Охрана и патрулирование · 1 робот')
  })

  it('marks templates of another facility type instead of hiding them (PRD 10.4, предложение)', () => {
    const baggage = templateOptions(khimki()).find((o) => o.code === 'PR-0008')
    expect(baggage?.isOtherFacilityType).toBe(true)
    expect(plain(baggage?.details)).toBe('OP-01 Перемещение грузов · 4 робота · другой тип объекта')
  })

  it('says there are no robots yet instead of «0 роботов»', () => {
    const food = templateOptions(khimki()).find((o) => o.code === 'PR-0010')
    expect(food?.details).toBe('OP-08 Адресная доставка · роботов с этим классом в каталоге нет · другой тип объекта')
  })

  it('omits the robot count for templates already on the location, as in the mock', () => {
    const pallets = templateOptions(khimki()).find((o) => o.code === 'PR-0001')
    expect(pallets?.details).toBe('OP-01 Перемещение грузов')
  })

  it('keeps an unknown operation class readable', () => {
    const odd: Process = { ...(PROCESSES[0] as Process), code: 'PR-0999', operationClass: 'OP-99' }
    const option = templateOptions(khimki({ processes: [odd], locationProcesses: [] }))[0]
    expect(option?.details).toBe('OP-99 · роботов с этим классом в каталоге нет')
  })
})

describe('searchTemplates', () => {
  it('finds templates by name or description ignoring case', () => {
    const options = templateOptions(khimki())
    expect(searchTemplates(options, 'БЕЛЬЯ').map((o) => o.name)).toEqual(['Транспорт белья'])
    expect(searchTemplates(options, 'проб').map((o) => o.name)).toEqual(['Доставка биоматериалов'])
    expect(searchTemplates(options, '  ')).toHaveLength(options.length)
  })
})
