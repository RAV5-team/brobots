import { describe, expect, it } from 'vitest'
import { conclusion, cumulativeCashFlow, operationCostRub } from './projectEconomics'

const M = 1_000_000

describe('cumulativeCashFlow', () => {
  it('RaaS сквозного примера: −6,1 · +3,1 · +12,3 · +21,5 · +30,7 · +39,9 млн ₽ (PRD 11.5)', () => {
    const flow = cumulativeCashFlow({ capexRub: 6.1 * M, annualEffectRub: 9.2 * M }, 5)
    expect(flow.map((v) => Math.round(v / 100_000) / 10)).toEqual([-6.1, 3.1, 12.3, 21.5, 30.7, 39.9])
  })

  it('покупка: к году 5 накоплено 36,1 млн ₽', () => {
    expect(cumulativeCashFlow({ capexRub: 47.4 * M, annualEffectRub: 16.7 * M }, 5).at(-1)).toBeCloseTo(36.1 * M)
  })

  it('горизонт задаёт число лет после года 0', () => {
    expect(cumulativeCashFlow({ capexRub: 1, annualEffectRub: 1 }, 7)).toHaveLength(8)
  })
})

describe('conclusion (PRD 11.5)', () => {
  const ok = { annualEffectRub: 9.2 * M, uncheckedConditions: 0, simulation: 'passed' as const }

  it('эффект есть, условия подтверждены, симуляция пройдена — предварительно целесообразно', () => {
    expect(conclusion(ok)).toBe('preliminary')
  })

  it('непроверенные условия или нет симуляции — целесообразно при условиях', () => {
    expect(conclusion({ ...ok, uncheckedConditions: 3 })).toBe('conditional')
    expect(conclusion({ ...ok, simulation: 'none' })).toBe('conditional')
  })

  it('эффект не больше нуля или состав «с риском» не вывозит поток — не рекомендуется', () => {
    expect(conclusion({ ...ok, annualEffectRub: 0 })).toBe('not_recommended')
    expect(conclusion({ ...ok, annualEffectRub: -2 * M })).toBe('not_recommended')
    expect(conclusion({ ...ok, simulation: 'risk_accepted' })).toBe('not_recommended')
  })

  it('вывод не строится на пороге окупаемости: долгая окупаемость при эффекте — всё равно целесообразно', () => {
    expect(conclusion({ ...ok, annualEffectRub: 1 })).toBe('preliminary')
  })
})

describe('operationCostRub', () => {
  it('стоимость операции — расходы в год на операции за год', () => {
    expect(operationCostRub(42 * M, 2000, 365)).toBeCloseTo(57.53, 2)
  })
})
