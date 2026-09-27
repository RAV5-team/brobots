import { describe, expect, it } from 'vitest'
import type { OperationClass, OperationClassCode } from '@/domain'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { buildOperationClassRows, countProcessesByClass } from './operationClassesModel'

const cls = (code: OperationClassCode, name = code): OperationClass => ({
  code, name, description: '', unit: 'ед.', workCategory: 'internal_logistics', typicalCarriers: [], exampleProcesses: [],
})

describe('countProcessesByClass', () => {
  it('counts library processes per class as in PRD 6.7 (OP-01 — 2, OP-08 — 4, OP-04 и OP-10 — нет)', () => {
    const counts = countProcessesByClass(PROCESSES)
    expect(counts['OP-01']).toBe(2)
    expect(counts['OP-08']).toBe(4)
    expect(counts['OP-04']).toBeUndefined()
    expect(counts['OP-10']).toBeUndefined()
  })

  it('sums up to six processes for OP-01 + OP-08 (PRD 15 · №33)', () => {
    const counts = countProcessesByClass(PROCESSES)
    expect((counts['OP-01'] ?? 0) + (counts['OP-08'] ?? 0)).toBe(6)
  })
})

describe('buildOperationClassRows', () => {
  it('keeps the directory order by code and fills zero counts', () => {
    const rows = buildOperationClassRows([cls('OP-02'), cls('OP-01')], { 'OP-01': 3 }, { 'OP-02': 1 })
    expect(rows.map((r) => [r.code, r.robotCount, r.processCount])).toEqual([
      ['OP-01', 3, 0],
      ['OP-02', 0, 1],
    ])
  })

  it('builds all ten rows of the demo directory', () => {
    const rows = buildOperationClassRows(OPERATION_CLASSES, {}, countProcessesByClass(PROCESSES))
    expect(rows).toHaveLength(10)
    expect(rows.filter((r) => r.processCount === 0).map((r) => r.code)).toEqual(['OP-04', 'OP-10'])
  })
})
