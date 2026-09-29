import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import type { RankedVariant } from '@/domain'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { withVariantDetails } from '@/services/mock/variantDetails'
import { economicsView } from './economicsTabModel'
import { findVariant } from './matchingModel'

const evaluation = withVariantDetails(toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01), 'LP-01')
const HORIZON = evaluation.horizonYears
const variant = (id: string, acquisition: 'purchase' | 'raas'): RankedVariant => {
  const v = findVariant(evaluation, id, acquisition)
  if (!v) throw new Error(`${id} ${acquisition}`)
  return v
}
const view = (v: RankedVariant) => economicsView({ variant: v, acquisitions: ['purchase', 'raas'], baseline: evaluation.baseline, horizonYears: HORIZON, demand: null })
const value = (rows: readonly { readonly key: string; readonly value: string | null }[], key: string) => rows.find((r) => r.key === key)?.value

describe('вкладка «Экономика» окна 2.1а: числа — варианта рейтинга 2.1', () => {
  it('AMR 800 · RaaS: заголовки CAPEX и OPEX, итог эффекта и формулы — как в рейтинге и сравнении с процессом', () => {
    const e = view(variant('RB-0008', 'raas'))
    expect(e.capex.title).toBe('Что входит в стартовые вложения · CAPEX 6,1\u00a0млн\u00a0₽')
    expect(e.opex.title).toBe('Что входит в ежегодные расходы · OPEX 42,0\u00a0млн\u00a0₽/год')
    expect(e.opex.caption).toBe('Сейчас: 51,2\u00a0млн\u00a0₽/год. Расходы снизятся на 9,2\u00a0млн\u00a0₽/год (18\u00a0%).')
    expect(e.effect.at(-1)).toMatchObject({ total: true, value: '9,2\u00a0млн\u00a0₽' })
    expect(value(e.formulas, 'payback')).toMatch(/= 0,7\u00a0года$/)
    expect(value(e.formulas, 'roi')).toMatch(/= 654\u00a0%$/)
    expect(value(e.formulas, 'tco')).toMatch(/= 216,1\u00a0млн\u00a0₽$/)
    expect(value(e.raas?.rows ?? [], 'monthly')).toBe('0,83\u00a0млн\u00a0₽')
  })

  it('AMR 800 · Покупка: свои числа и без условий RaaS', () => {
    const e = view(variant('RB-0008', 'purchase'))
    expect(e.raas).toBeNull()
    expect(value(e.formulas, 'payback')).toMatch(/= 2,8\u00a0года$/)
    expect(value(e.formulas, 'roi')).toMatch(/= 76\u00a0%$/)
    expect(value(e.formulas, 'tco')).toMatch(/= 219,9\u00a0млн\u00a0₽$/)
    expect(value(e.price, 'software')).toBe('разово 0,9\u00a0млн\u00a0₽ · подписка 0,6\u00a0млн\u00a0₽/год')
  })

  it('результаты формул сходятся с входами: окупаемость, ROI и TCO пересчитываются из CAPEX, OPEX и эффекта', () => {
    for (const v of [variant('RB-0008', 'raas'), variant('RB-0008', 'purchase')]) {
      expect(v.capexRub / v.annualEffectRub).toBeCloseTo(v.paybackYears ?? Number.NaN, 1)
      expect((v.annualEffectRub * HORIZON - v.capexRub) / v.capexRub).toBeCloseTo(v.roi ?? Number.NaN, 1)
      expect(v.capexRub + v.opexRubPerYear * HORIZON).toBeCloseTo(v.tcoRub ?? Number.NaN, -5)
      expect(v.capexItems.reduce((s, i) => s + i.amountRub, 0)).toBeCloseTo(v.capexRub, -5)
    }
  })

  it('RaaS без условий в данных: только платёж за парк и пометка «расчёт не отдал» (ждёт решения)', () => {
    const e = view(variant('RB-0001', 'raas'))
    expect(e.raas?.pending).toBe(true)
    expect(e.raas?.rows.map((r) => r.key)).toEqual(['monthly'])
    expect(value(e.price, 'unitPrice')).toBeNull()
    expect(e.capex.items).toEqual([])
  })
})
