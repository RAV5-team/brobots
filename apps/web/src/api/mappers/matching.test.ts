import { describe, expect, it } from 'vitest'
import type { ApiSchemas } from '../contract'
import { toMatchingEvaluation } from './matching'

type Evaluation = ApiSchemas['Evaluation']
type CalcResult = ApiSchemas['CalcResult']

const M = 1_000_000

const result = (patch: Partial<CalcResult>): CalcResult => ({
  id: 'R-1', solutionId: 'RB-0008', acquisitionModel: 'raas', rank: 1, score: 0.91, robotCount: 18, chargerCount: 6,
  capexRub: 6.1 * M, opexYearRub: 42 * M, netEffectYearRub: 9.2 * M, laborSavingsYearRub: 16.7 * M, paybackYears: 0.7,
  roi: 6.54, tcoRub: 216.1 * M, warnings: [],
  details: {
    opexItems: [{ code: 'opex.annual_raas_cost', label: 'Платёж RaaS', amountRub: 9.9 * M }],
    scoreCriteria: [{ code: 'payback', label: 'Окупаемость', weight: 30, contribution: 0.3 }],
  },
  ...patch,
})

const evaluation: Evaluation = {
  id: 'EV-1', horizonYears: 5, modelVersion: '2.1', stale: false, recommendedResultId: 'R-1',
  conditions: [{ code: 'payload', label: 'Грузоподъёмность', number: 800, unit: 'кг', source: 'task', applicable: true }],
  counts: { total: 3, passed: 1, needsVerification: 1, excluded: 1, manual: 0 },
  candidates: [
    {
      match: { state: 'passed', isManual: false, solution: { id: 'RB-0001', name: 'Ronavi H1500', manufacturer: 'ООО «Ронави Роботикс»' }, checks: [] },
      results: [result({ id: 'R-2', solutionId: 'RB-0001', rank: 2, score: 0.78, chargerCount: null, roi: null, tcoRub: null })],
    },
    {
      match: { state: 'needs_verification', isManual: false, solution: { id: 'RB-0008', name: 'AMR 800', manufacturer: 'ООО «Морос»' }, checks: [] },
      results: [
        result({}),
        result({ id: 'R-3', acquisitionModel: 'purchase', rank: 4, capexRub: 47.4 * M, details: { opexItems: [] } }),
      ],
    },
    {
      match: {
        state: 'excluded', isManual: false, solution: { id: 'RB-0011', name: 'MARK 2 SE', manufacturer: 'Р2Б' },
        checks: [
          { code: 'work_type', label: 'Класс операции', status: 'fail', message: 'нужно OP-01, есть OP-07' },
          { code: 'payload', label: 'Грузоподъёмность', status: 'pass' },
        ],
      },
    },
  ],
}

describe('toMatchingEvaluation', () => {
  const mapped = toMatchingEvaluation(evaluation)

  it('варианты — пары «решение × способ приобретения» по месту в рейтинге', () => {
    expect(mapped.variants.map((v) => [v.solutionName, v.acquisition, v.rank])).toEqual([
      ['AMR 800', 'raas', 1], ['Ronavi H1500', 'raas', 2], ['AMR 800', 'purchase', 4],
    ])
  })

  it('RaaS в месяц — годовой платёж RaaS ÷ 12; у покупки — нет', () => {
    expect(mapped.variants[0]?.raasMonthlyRub).toBe(825_000)
    expect(mapped.variants[2]?.raasMonthlyRub).toBeNull()
  })

  it('вклад критериев: вес из процентов в долю', () => {
    expect(mapped.variants[0]?.criteria).toEqual([{ code: 'payback', label: 'Окупаемость', weight: 0.3, contribution: 0.3 }])
  })

  it('статус варианта — из отбора решения; отсутствующие ROI, TCO и станции — null', () => {
    expect(mapped.variants[0]?.status).toBe('needs_verification')
    expect(mapped.variants[1]).toMatchObject({ status: 'passed', stations: null, roi: null, tcoRub: null })
  })

  it('исключённые — с непройденными проверками', () => {
    expect(mapped.excluded).toEqual([{
      solutionId: 'RB-0011', solutionName: 'MARK 2 SE', manufacturer: 'Р2Б',
      reasons: [{ code: 'work_type', label: 'Класс операции', status: 'fail', message: 'нужно OP-01, есть OP-07' }],
    }])
  })

  it('рекомендация — по recommendedResultId; условия и счётчики', () => {
    expect(mapped.recommended).toEqual({ solutionId: 'RB-0008', acquisition: 'raas' })
    expect(mapped.conditions[0]).toMatchObject({ code: 'payload', number: 800, unit: 'кг', text: null, list: [] })
    expect(mapped.counts).toEqual({ total: 3, passed: 1, needsVerification: 1, excluded: 1, manual: 0 })
  })

  it('поля окна 2.1а, которые отдаёт API: ограничения, пояснение, предложение, шаги расчёта', () => {
    const withDetails = structuredClone(evaluation)
    const candidate = withDetails.candidates?.[1]
    if (!candidate?.match || !candidate.results?.[0]) throw new Error('нет кандидата AMR 800')
    candidate.match.risks = ['specs_unconfirmed']
    candidate.match.summary = 'Класс операции и способ совпадают с процессом'
    candidate.match.offerId = 'OF-0008-01'
    candidate.results[0].trace = [{
      code: 'robot_count', label: 'Роботов', formula: '⌈130 ÷ 8,6⌉', value: 18, unit: 'шт.', source: 'derived',
      inputs: [{ name: 'пик', value: 130 }, { name: 'интерпретация', text: 'с запасом' }],
    }]
    const variant = toMatchingEvaluation(withDetails).variants[0]
    expect(variant).toMatchObject({ limitations: ['specs_unconfirmed'], summary: 'Класс операции и способ совпадают с процессом', offerId: 'OF-0008-01' })
    expect(variant?.calcTrace).toEqual([{
      code: 'robot_count', label: 'Роботов', formula: '⌈130 ÷ 8,6⌉', value: 18, unit: 'шт.', text: null, source: 'derived',
      inputs: [{ name: 'пик', value: 130, text: null }, { name: 'интерпретация', value: null, text: 'с запасом' }],
    }])
  })

  it('чего API не отдал, того нет в варианте: поля 2.1а необязательные', () => {
    const variant = mapped.variants[0]
    for (const key of ['limitations', 'summary', 'offerId', 'calcTrace', 'priceOffer', 'raasTerms', 'scoreBreakdown']) {
      expect(variant).not.toHaveProperty(key)
    }
  })

  it('неизвестный источник шага расчёта — ошибка контракта', () => {
    const broken = structuredClone(evaluation)
    const result = broken.candidates?.[1]?.results?.[0]
    if (!result) throw new Error('нет результата')
    result.trace = [{ code: 'x', source: 'guess' as 'task' }]
    expect(() => toMatchingEvaluation(broken)).toThrow('TraceItem.source')
  })

  it('нет числа роботов у результата — ошибка контракта с указанием места', () => {
    const broken = structuredClone(evaluation)
    delete broken.candidates?.[0]?.results?.[0]?.robotCount
    expect(() => toMatchingEvaluation(broken)).toThrow('CalcResult R-2: в ответе API нет обязательного поля «robotCount»')
  })
})
