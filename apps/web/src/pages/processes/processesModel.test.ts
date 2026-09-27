import { describe, expect, it } from 'vitest'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { defaultRows, EMPTY_FILTER, filterProcesses, isFilterActive, rateUnit } from './processesModel'

const byCode = (code: string) => {
  const process = PROCESSES.find((p) => p.code === code)
  if (!process) throw new Error(code)
  return process
}
const names = (list: readonly { name: string }[]) => list.map((p) => p.name)
const values = (code: string) => Object.fromEntries(defaultRows(byCode(code)).map((r) => [r.key, r.value]))

describe('filterProcesses (PRD 9.1)', () => {
  it('returns every process without filters', () => {
    expect(filterProcesses(PROCESSES, EMPTY_FILTER)).toHaveLength(12)
  })

  it('searches name and description, ignoring case and ё', () => {
    expect(names(filterProcesses(PROCESSES, { ...EMPTY_FILTER, query: 'ПАЛЛЕТ' }))).toContain('Перемещение паллет')
    expect(names(filterProcesses(PROCESSES, { ...EMPTY_FILTER, query: 'твердых покрытий' }))).toEqual(['Уборка помещений'])
  })

  it('filters by operation class', () => {
    expect(names(filterProcesses(PROCESSES, { ...EMPTY_FILTER, operationClass: 'OP-01' }))).toEqual(['Перемещение паллет', 'Перемещение багажа'])
  })

  it('filters by facility type, including processes of any object', () => {
    const medical = names(filterProcesses(PROCESSES, { ...EMPTY_FILTER, facilityType: 'medical' }))
    expect(medical).toContain('Транспорт белья')
    expect(medical).toContain('Патрулирование и охрана')
    expect(medical).not.toContain('Перемещение паллет')
  })

  it('combines filters and query', () => {
    expect(filterProcesses(PROCESSES, { query: 'паллет', operationClass: 'OP-08', facilityType: null })).toEqual([])
  })

  it('knows when a filter is set', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTER, query: '  ' })).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTER, facilityType: 'airport' })).toBe(true)
  })
})

describe('card values (PRD 9.1, README fixtures)', () => {
  it('shows the productivity unit per hour, patrols per day', () => {
    expect(rateUnit(byCode('PR-0001'))).toBe('паллет / ч')
    expect(rateUnit(byCode('PR-0007'))).toBe('обходов / сут')
  })

  it('renders seven default rows of «Перемещение паллет» with resolved values (PRD 15 · 37–39)', () => {
    expect(values('PR-0001')).toEqual({
      volume: '2 000 паллет / сут',
      hours: '22 ч',
      route: '100 м',
      automation: '95 %',
      mass: '800 кг',
      divisible: 'Нет',
      carrier: 'паллета на полу',
    })
  })

  it('uses a dash where there is no cargo and a cycle for inventory', () => {
    expect(values('PR-0005')).toMatchObject({ volume: '20 000 паллетомест / цикл', mass: '—', divisible: '—' })
  })
})
