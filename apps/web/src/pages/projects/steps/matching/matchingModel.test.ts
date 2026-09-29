import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { withVariantDetails } from '@/services/mock/variantDetails'
import {
  barPercent,
  brandOf,
  breakdownOf,
  calcFields,
  conditionValue,
  contributionsText,
  effectiveOverrides,
  manualEntries,
  parseCalcField,
  rankingRows,
  shortReasonsText,
  recommendedVariant,
  scenariosOf,
  topContributions,
  variantKey,
  type CalcFieldSpec,
} from './matchingModel'

const evaluation = toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01)
const spec = (key: CalcFieldSpec['key']) => {
  const found = calcFields(5).find((f) => f.key === key)
  if (!found) throw new Error(key)
  return found
}

describe('рейтинг подбора (PRD 11.3)', () => {
  it('8 вариантов по баллу; рекомендация — первое место', () => {
    const rows = rankingRows(evaluation.variants, { filter: 'all', sort: 'score' })
    expect(rows.map((v) => v.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows[0] && variantKey(rows[0])).toBe('RB-0008:raas')
    expect(recommendedVariant(evaluation)).toBe(rows[0])
  })

  it('фильтр по способу приобретения, сортировка по окупаемости — «не окупается» в конце', () => {
    expect(rankingRows(evaluation.variants, { filter: 'raas', sort: 'score' })).toHaveLength(4)
    expect(rankingRows(evaluation.variants, { filter: 'all', sort: 'capex' })[0]?.capexRub).toBe(6_100_000)
    const byPayback = rankingRows(evaluation.variants, { filter: 'all', sort: 'payback' })
    expect(byPayback[0]?.paybackYears).toBe(0.7)
    expect(byPayback.at(-1)?.paybackYears).toBeNull()
  })

  it('«почему»: три главных вклада по убыванию', () => {
    const amr = recommendedVariant(evaluation)
    expect(topContributions(amr?.criteria ?? []).map((c) => c.code)).toEqual(['payback', 'roi', 'tco_savings'])
    expect(contributionsText(topContributions(amr?.criteria ?? []))).toBe('окупаемость 0,30 + ROI 0,15 + TCO 0,10')
  })

  it('строка рейтинга: бренд без организационно-правовой формы (16742:40)', () => {
    expect(brandOf('ООО «Морос»')).toBe('Морос')
    expect(brandOf('АО «Когнитив Пилот»')).toBe('Когнитив Пилот')
    expect(brandOf('Ronavi')).toBe('Ronavi')
  })

  it('разбор балла: полоса — вклад как доля веса, у всех 8 вариантов сумма вкладов = балл', () => {
    expect(barPercent({ code: 'x', label: 'x', weight: 0.1, contribution: 0.09 })).toBeCloseTo(90)
    expect(barPercent({ code: 'x', label: 'x', weight: 0.1, contribution: 0.15 })).toBe(100)
    expect(barPercent({ code: 'x', label: 'x', weight: 0.1, contribution: null })).toBe(0)
    for (const v of withVariantDetails(evaluation, 'LP-01').variants) {
      const criteria = breakdownOf(v)
      expect(criteria).toHaveLength(8)
      expect(criteria.slice(2, 4).map((c) => c.code)).toEqual(['budget_fit', 'tco_savings'])
      expect(criteria.reduce((sum, c) => sum + (c.contribution ?? 0), 0)).toBeCloseTo(v.score ?? 0, 2)
    }
  })

  it('причина исключения коротко: «фактическое вместо требуемого»', () => {
    const sd = evaluation.excluded.find((e) => e.solutionId === 'RB-0004')
    if (!sd) throw new Error('Ronavi SD')
    expect(shortReasonsText(sd)).toBe('класс операции OP-08 Адресная доставка вместо OP-01 Перемещение грузов; грузоподъёмность 10 кг вместо ≥ 800 кг')
  })

  it('условия: знак сравнения у грузоподъёмности и ширины, список способов через «/»', () => {
    const value = (code: string) => {
      const condition = evaluation.conditions.find((c) => c.code === code)
      if (!condition) throw new Error(code)
      return conditionValue(condition)
    }
    expect(value('payload')).toBe('≥ 800 кг')
    expect(value('aisle_width')).toBe('≤ 2,2 м')
    expect(value('handling')).toBe('вилы / платформа')
  })

  it('покупка и RaaS одного решения — для «Сравнить с текущим процессом»', () => {
    expect(scenariosOf(evaluation, 'RB-0008').map((v) => v.acquisition)).toEqual(['purchase', 'raas'])
  })
})

describe('ручное добавление', () => {
  it('добавленные вручную — в порядке добавления', () => {
    expect(manualEntries(evaluation.excluded, ['RB-0021', 'RB-0004']).map((m) => m.solutionName)).toEqual(['MARK 2 SE', 'Ronavi SD'])
  })
})

describe('«Параметры расчёта» (PRD 11.3, ТЗ 3.5.3)', () => {
  it('пустое поле — исходное значение; вне диапазона — понятная ошибка', () => {
    expect(parseCalcField(spec('utilization'), '')).toEqual({ ok: true, value: null })
    expect(parseCalcField(spec('utilization'), '0,7')).toEqual({ ok: true, value: 0.7 })
    expect(parseCalcField(spec('horizonYears'), '3')).toEqual({ ok: false, error: 'Введите число от 5 до 15' })
    expect(parseCalcField(spec('staffCostRubPerMonth'), 'много')).toEqual({ ok: false, error: 'Введите число, например 0,75' })
  })

  it('обслуживание вводится в млн ₽, хранится в рублях', () => {
    expect(parseCalcField(spec('serviceCostRubPerYear'), '2,1')).toEqual({ ok: true, value: 2_100_000 })
  })

  it('значение, равное исходному, изменением не считается', () => {
    expect(effectiveOverrides({ workHoursPerDay: 22, utilization: 0.7 }, CALC_DEFAULTS_LP01)).toEqual({ utilization: 0.7 })
  })
})
