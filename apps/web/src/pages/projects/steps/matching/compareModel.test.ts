import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { siteFactsOf } from '@/domain'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { NORMS } from '@/mocks/fixtures/norms'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { SITE_VALUES } from '@/mocks/fixtures/siteParameters'
import { withVariantDetails } from '@/services/mock/variantDetails'
import { compareGroups, type CompareContext, type CompareEntry } from './compareModel'
import { findVariant, manualEntries, variantKey } from './matchingModel'

const evaluation = withVariantDetails(toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01), 'LP-01')
const himki = LOCATIONS.find((l) => l.id === 'LOC-01')
const margin = NORMS.find((n) => n.code === 'width_margin_m')?.value
if (!himki || typeof margin !== 'number') throw new Error('РЦ Химки и норматив запаса')
const ctx: CompareContext = {
  characteristics: { operationClasses: OPERATION_CLASSES, processes: PROCESSES, facilityTypes: FACILITY_TYPES, catalogVersion: 'v4' },
  baseline: evaluation.baseline,
  horizonYears: evaluation.horizonYears,
  site: siteFactsOf(himki, SITE_VALUES['LOC-01'] ?? {}),
  widthMarginM: margin,
}
const entry = (id: string, acquisition: 'purchase' | 'raas'): CompareEntry => {
  const v = findVariant(evaluation, id, acquisition)
  if (!v) throw new Error(id)
  return { key: variantKey(v), name: v.solutionName, variant: v, robot: ROBOTS.find((r) => r.id === id) ?? null, violations: null }
}

describe('окно 2.1б «Сравнение вариантов» (16833:10)', () => {
  const groups = compareGroups([entry('RB-0008', 'raas'), entry('RB-0001', 'raas')], ctx)
  const cells = (group: string, row: string) => groups.find((g) => g.key === group)?.rows.find((r) => r.key === row)?.cells ?? []

  it('три группы по макету: экономика 11 строк, техника 10, инфраструктура и данные 3', () => {
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([['economics', 11], ['technical', 10], ['data', 3]])
  })

  it('экономика — числа рейтинга 2.1: CAPEX, платёж RaaS, изменение OPEX, окупаемость', () => {
    expect(cells('economics', 'capex').map((c) => c.content)).toEqual(['6,1 млн ₽', '7,3 млн ₽'])
    expect(cells('economics', 'raas').map((c) => c.content)).toEqual(['0,83 млн ₽', '1,03 млн ₽'])
    expect(cells('economics', 'opexChange')[0]?.content).toBe('−9,2 млн ₽/год')
    expect(cells('economics', 'payback')[0]?.content).toBe('0,7 года')
  })

  it('техника — характеристики К-4: оценка серым, как в К-3', () => {
    const payload = cells('technical', 'payload')
    expect(payload[0]?.content).toContain('800')
    expect(payload.every((c) => c.tone === 'default' || c.tone === 'unconfirmed')).toBe(true)
  })

  it('«Требует проверки» — ячейка соответствия К-3 по правилу площадки (D-99): у РЦ Химки 2 требования без данных', () => {
    const [amr] = cells('data', 'siteChecks')
    expect(amr?.content).toMatch(/^2 из \d+$/)
    expect(amr?.tone).toBe('unknown')
  })

  it('добавленное вручную: экономика «не рассчитано», нарушенное условие — красная ячейка', () => {
    const [sd] = manualEntries(evaluation.excluded, ['RB-0004'])
    if (!sd) throw new Error('Ronavi SD')
    const manual = compareGroups([{ key: sd.solutionId, name: sd.solutionName, variant: null, robot: ROBOTS.find((r) => r.id === sd.solutionId) ?? null, violations: sd.reasons }], ctx)
    const cell = (group: string, row: string) => manual.find((g) => g.key === group)?.rows.find((r) => r.key === row)?.cells[0]
    expect(cell('economics', 'capex')?.content).toBe('не рассчитано')
    expect(cell('technical', 'payload')?.tone).toBe('misfit')
  })
})
