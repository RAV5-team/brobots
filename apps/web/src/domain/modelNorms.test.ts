import { describe, expect, it } from 'vitest'
import { NORMS } from '@/mocks/fixtures/norms'
import { staffEquivalent } from './economicsModel'
import { DEFAULT_MODEL_NORMS, modelNormsFrom } from './modelNorms'

describe('нормативы А5 в расчётах (аудит 2026-09-28, §3)', () => {
  it('значения справочника совпадают с запасными: экраны до и после загрузки одинаковы', () => {
    expect(modelNormsFrom(NORMS)).toEqual(DEFAULT_MODEL_NORMS)
  })

  it('правка норматива меняет расчёт; проценты — долями', () => {
    const edited = NORMS.map((n) => {
      if (n.code === 'payroll_tax_ratio') return { ...n, value: 1.5 }
      if (n.code === 'sensitivity_step_pct') return { ...n, value: 10 }
      if (n.code === 'simulation_tolerance_pct') return { ...n, value: 15 }
      if (n.code === 'horizon_years') return { ...n, value: 7 }
      return n
    })
    const norms = modelNormsFrom(edited)
    expect(norms).toEqual({ payrollTaxRatio: 1.5, sensitivityShift: 0.1, simulationTolerance: 0.15, horizonYears: 7, widthMarginM: 0.6 })
    expect(staffEquivalent(18_000_000, 100_000, norms.payrollTaxRatio)).toBe(10)
  })

  it('нет норматива в справочнике — запасное значение', () => {
    expect(modelNormsFrom([])).toEqual(DEFAULT_MODEL_NORMS)
  })
})
