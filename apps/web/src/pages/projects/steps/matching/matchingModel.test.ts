import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { HANDLING_METHODS } from '@/mocks/fixtures/operationClasses'
import { compareGroups } from './compareModel'
import {
  calcFields,
  conditionValue,
  contributionsText,
  effectiveOverrides,
  manualEntries,
  parseCalcField,
  rankingRows,
  recommendedVariant,
  scenariosOf,
  toggleKey,
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
    const rows = rankingRows(evaluation.variants, { filter: 'all', query: '', sort: 'score' })
    expect(rows.map((v) => v.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows[0] && variantKey(rows[0])).toBe('RB-0008:raas')
    expect(recommendedVariant(evaluation)).toBe(rows[0])
  })

  it('фильтр по способу приобретения, поиск по производителю, сортировка по окупаемости — «не окупается» в конце', () => {
    expect(rankingRows(evaluation.variants, { filter: 'raas', query: '', sort: 'score' })).toHaveLength(4)
    expect(rankingRows(evaluation.variants, { filter: 'all', query: 'ронави', sort: 'score' })).toHaveLength(4)
    const byPayback = rankingRows(evaluation.variants, { filter: 'all', query: '', sort: 'payback' })
    expect(byPayback[0]?.paybackYears).toBe(0.7)
    expect(byPayback.at(-1)?.paybackYears).toBeNull()
  })

  it('«почему»: три главных вклада по убыванию', () => {
    const amr = recommendedVariant(evaluation)
    expect(topContributions(amr?.criteria ?? []).map((c) => c.code)).toEqual(['payback', 'roi', 'tco_savings'])
    expect(contributionsText(topContributions(amr?.criteria ?? []))).toBe('окупаемость 0,30 + ROI 0,15 + TCO 0,10')
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

describe('сравнение и ручное добавление', () => {
  it('не больше лимита; повторная отметка снимает', () => {
    expect(toggleKey(['a', 'b'], 'c', 3)).toEqual(['a', 'b', 'c'])
    expect(toggleKey(['a', 'b', 'c'], 'd', 3)).toBeNull()
    expect(toggleKey(['a', 'b'], 'a', 3)).toEqual(['b'])
  })

  it('добавленные вручную — в порядке добавления; нарушенное условие — красная ячейка', () => {
    const manual = manualEntries(evaluation.excluded, ['RB-0021', 'RB-0004'])
    expect(manual.map((m) => m.solutionName)).toEqual(['MARK 2 SE', 'Ronavi SD'])
    const sd = manual[1]
    if (!sd) throw new Error('Ronavi SD не добавлен')
    const groups = compareGroups(
      [{ key: sd.solutionId, name: sd.solutionName, variant: null, robot: ROBOTS.find((r) => r.id === sd.solutionId) ?? null, violations: sd.reasons }],
      { handlingMethods: HANDLING_METHODS, siteUnchecked: 2 },
    )
    const cell = (group: string, row: string) => groups.find((g) => g.key === group)?.rows.find((r) => r.key === row)?.cells[0]
    expect(cell('economics', 'capex')?.content).toBe('не рассчитано')
    expect(cell('technical', 'payload')?.tone).toBe('misfit')
    expect(cell('data', 'siteChecks')?.tone).toBe('unknown')
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
