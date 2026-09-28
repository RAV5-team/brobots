import { describe, expect, it } from 'vitest'
import { cumulativeCashFlow, operationCostRub } from '@/domain'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { toEconomics } from './economics'

const M = 1_000_000
const EXTRAS = { conditions: [], operationsPerDay: 2000 }

describe('toEconomics — итог из расчёта подбора (PRD 11.5)', () => {
  const economics = toEconomics(EVALUATION_LP01, 'RB-0008', EXTRAS)
  const scenario = (acq: 'raas' | 'purchase') => economics.scenarios.find((s) => s.acquisition === acq)

  it('сценарии выбранного решения: покупка и RaaS с числами PRD', () => {
    expect(scenario('raas')).toMatchObject({ robots: 18, stations: 6, capexRub: 6.1 * M, raasMonthlyRub: 825_000, opexRubPerYear: 42 * M, annualEffectRub: 9.2 * M, paybackYears: 0.7, roi: 6.54 })
    expect(scenario('purchase')).toMatchObject({ capexRub: 47.4 * M, raasMonthlyRub: null, opexRubPerYear: 34.5 * M, annualEffectRub: 16.7 * M, paybackYears: 2.8, tcoRub: 219.9 * M })
  })

  it('решение, место в рейтинге и рекомендация: RaaS — место 1 из 8, покупка — 4', () => {
    expect(economics).toMatchObject({ solutionName: 'AMR 800', manufacturer: 'ООО «Морос»', rankedTotal: 8, recommended: 'raas' })
    expect(scenario('raas')?.rank).toBe(1)
    expect(scenario('purchase')?.rank).toBe(4)
    expect(scenario('purchase')?.capexItems.map((i) => i.code)).toContain('capex.equipment')
  })

  it('база — текущий процесс из details: OPEX 51,2, TCO 256,0 млн ₽', () => {
    expect(economics.current).toEqual({ opexRubPerYear: 51.2 * M, tcoRub: 256 * M })
    expect(economics.horizonYears).toBe(5)
  })

  it('производные числа итога сходятся с PRD: поток к году 5 и стоимость операции', () => {
    const raas = scenario('raas')
    const purchase = scenario('purchase')
    if (!raas || !purchase) throw new Error('нет сценариев')
    expect(cumulativeCashFlow(raas, economics.horizonYears).at(-1)).toBeCloseTo(39.9 * M)
    expect(cumulativeCashFlow(purchase, economics.horizonYears).at(-1)).toBeCloseTo(36.1 * M)
    expect(operationCostRub(raas.opexRubPerYear, economics.operationsPerDay)).toBeCloseTo(57.5, 1)
    expect(operationCostRub(purchase.opexRubPerYear, economics.operationsPerDay)).toBeCloseTo(47.3, 1)
    expect(operationCostRub(economics.current.opexRubPerYear, economics.operationsPerDay)).toBeCloseTo(70.1, 1)
  })

  it('решения нет в расчёте — понятная ошибка', () => {
    expect(() => toEconomics(EVALUATION_LP01, 'RB-9999', EXTRAS)).toThrow('Evaluation: в расчёте нет решения RB-9999')
  })
})
