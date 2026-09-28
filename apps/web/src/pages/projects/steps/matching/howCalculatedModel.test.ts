import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { contributionsSum, howCalcSections, SCORE_TOLERANCE } from './howCalculatedModel'
import { findVariant } from './matchingModel'

const evaluation = toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01)
const amrRaas = findVariant(evaluation, 'RB-0008', 'raas')
const demand = { perDay: 2000, hours: 22, peakFactor: 1.5, share: 0.95, perHour: 2000 / 22 * 1.5 * 0.95, unit: 'паллет' }

const sections = (variant = amrRaas) => {
  if (!variant) throw new Error('нет AMR 800 · RaaS в фикстуре')
  return howCalcSections({ variant, processName: 'Перемещение паллет', demand, params: CALC_DEFAULTS_LP01, baseline: evaluation.baseline })
}
const stat = (section: string, key: string) => sections().find((s) => s.key === section)?.stats.find((s) => s.key === key)

describe('вклад критериев равен баллу (PRD 11.3; PRD 15 · №20)', () => {
  it('у каждого варианта с полными вкладами сумма равна баллу с точностью до округления', () => {
    const withContributions = evaluation.variants.filter((v) => contributionsSum(v.criteria) !== null)
    expect(withContributions.length).toBeGreaterThan(0)
    for (const v of withContributions) {
      expect(Math.abs((contributionsSum(v.criteria) ?? 0) - (v.score ?? 0)), `${v.solutionName} · ${v.acquisition}`).toBeLessThan(SCORE_TOLERANCE)
    }
  })

  it('веса критериев в сумме — 100 % (PRD 11.3, D-88)', () => {
    for (const v of evaluation.variants.filter((x) => x.criteria.length > 0)) {
      expect(v.criteria.reduce((acc, c) => acc + c.weight, 0)).toBeCloseTo(1)
    }
  })

  it('секция «Балл рейтинга»: 8 критериев с весом и итог 0,91 = сумма вкладов', () => {
    const score = sections().find((s) => s.key === 'score')
    expect(score?.stats).toHaveLength(9)
    expect(score?.stats[0]).toMatchObject({ label: 'Окупаемость', value: '0,30', formula: 'вес 30 %' })
    expect(score?.stats.at(-1)).toMatchObject({ value: '0,91', formula: 'сумма вкладов = 0,91' })
  })

  it('без вкладов — одна строка «не рассчитан», а не нули', () => {
    const purchase = findVariant(evaluation, 'RB-0008', 'purchase') ?? undefined
    const score = sections(purchase).find((s) => s.key === 'score')
    expect(score?.stats).toEqual([{ key: 'total', label: 'Балл', value: '0,72', formula: 'Вклад критериев для этого варианта не рассчитан' }])
  })
})

describe('пошаговый расчёт (03a)', () => {
  it('потребность — как на шаге 1: 2 000 ÷ 22 ч × 1,5 × 95 % = 130 паллет/ч', () => {
    expect(stat('demand', 'peak')).toMatchObject({ value: '130 паллет/ч', formula: '2 000 ÷ 22 ч × 1,5 × 95 %' })
  })

  it('производительность — из «Параметров расчёта» (8,6), расхождение с циклом (8,65) видно в формуле (№109)', () => {
    expect(stat('fleet', 'productivity')).toMatchObject({ value: '8,6 рейса/ч', formula: '3 600 ÷ 312 с × загрузка 0,75 ≈ 8,65; в расчёте — значение «Параметров расчёта»' })
    expect(stat('fleet', 'robots')?.formula).toBe('130 ÷ 8,6 = 15,1 без резерва; с доступностью и резервом — итог подбора')
    expect(stat('fleet', 'stations')?.formula).toBe('18 ÷ 6 — 1 станция на 3 робота')
  })

  it('деньги сходятся со статьями: CAPEX 6,1 = 3,1 + 0,5 + 2,5; эффект = 51,2 − 42', () => {
    expect(stat('money', 'capex')?.formula).toBe('зарядная инфраструктура 3,1 + подготовка объекта 0,5 + пусконаладка; для raas — установочный платёж 2,5')
    expect(stat('money', 'effect')?.formula).toBe('OPEX сейчас 51,2 − OPEX 42')
    expect(stat('money', 'labor')?.formula).toBe('ФОТ сейчас 46,9 − оставшийся ФОТ 30,2')
    expect(stat('money', 'payback')).toMatchObject({ value: '0,7 года', formula: 'CAPEX 6,1 ÷ эффект 9,2' })
  })
})
