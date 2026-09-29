import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { toSimulationRun } from '@/api/mappers/simulation'
import type { SimulationVerdict } from '@/domain'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { findVariant } from '../matching/matchingModel'
import {
  economicsRows,
  kpisLine,
  planCheck,
  planDelta,
  planOf,
  previewEconomics,
  servedShare,
  verdictAction,
} from './verdictModel'

const evaluation = toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01)
const amrRaas = findVariant(evaluation, 'RB-0008', 'raas')
if (!amrRaas) throw new Error('нет AMR 800 · RaaS в фикстуре')
const variant = amrRaas

const runs = SIMULATION_RUNS.map(toSimulationRun)
const runOf = (verdict: SimulationVerdict) => {
  const run = runs.find((r) => r.verdict === verdict)
  if (!run) throw new Error(`нет прогона ${verdict}`)
  return run
}

describe('план вердикта (PRD 11.4, D-104)', () => {
  it('без сохранённого плана — рекомендация симуляции', () => {
    expect(planOf(null, runOf('can_reduce'))).toEqual({ robots: 16, stations: 5 })
    expect(planOf({ robots: 17, stations: 6 }, runOf('can_reduce'))).toEqual({ robots: 17, stations: 6 })
  })

  it('рекомендация проверена итогом прогона, прежний состав — kpis_before, свой — не проверен', () => {
    const run = runOf('need_more')
    expect(planCheck(run, { robots: 18, stations: 6 })?.kind).toBe('to')
    expect(planCheck(run, { robots: 15, stations: 6 })).toEqual({ kind: 'from', kpis: run.before })
    expect(planCheck(run, { robots: 20, stations: 6 })).toBeNull()
  })

  it('дельта строки: типографский минус, без изменения — не показывается', () => {
    expect(planDelta(16, 18)).toBe('−2')
    expect(planDelta(19, 18)).toBe('+1')
    expect(planDelta(18, 18)).toBeNull()
  })
})

describe('действие вердикта', () => {
  it('узкое место и недостижимо — переход к экономике закрыт при любом составе', () => {
    expect(verdictAction(runOf('layout_bottleneck'), { robots: 18, stations: 6 }, false)).toBe('closed')
    expect(verdictAction(runOf('unreachable'), { robots: 18, stations: 6 }, true)).toBe('closed')
  })

  it('рекомендация и проверенный исходный состав принимаются', () => {
    expect(verdictAction(runOf('can_reduce'), { robots: 16, stations: 5 }, false)).toBe('accept')
    expect(verdictAction(runOf('can_reduce'), { robots: 18, stations: 6 }, false)).toBe('accept')
    expect(verdictAction(runOf('confirmed'), { robots: 18, stations: 6 }, false)).toBe('accept')
  })

  it('«нужно докупить»: прежний состав — только с принятым риском (07b)', () => {
    const run = runOf('need_more')
    expect(verdictAction(run, { robots: 15, stations: 6 }, false)).toBe('rerun')
    expect(verdictAction(run, { robots: 15, stations: 6 }, true)).toBe('acceptRisk')
    expect(verdictAction(run, { robots: 18, stations: 6 }, false)).toBe('accept')
  })

  it('свой состав — повторный прогон (07c)', () => {
    expect(verdictAction(runOf('confirmed'), { robots: 20, stations: 6 }, false)).toBe('rerun')
  })
})

describe('экономика, предварительно (D-104)', () => {
  it('состав подбора — ровно числа подбора', () => {
    const same = previewEconomics(variant, { robots: 18, stations: 6 })
    expect(same.capexRub).toBeCloseTo(variant.capexRub)
    expect(same.annualEffectRub).toBeCloseTo(variant.annualEffectRub)
    expect(same.utilization).toBeCloseTo(0.83)
  })

  it('минус 2 робота и 1 станция: платёж и энергия падают, CAPEX — на станцию, загрузка растёт', () => {
    const less = previewEconomics(variant, { robots: 16, stations: 5 })
    // Станция 3,1 ÷ 6; платёж RaaS 9,9 и энергия 0,4 — на робота.
    expect(less.capexRub).toBeCloseTo(6.1e6 - 3.1e6 / 6)
    expect(less.annualEffectRub).toBeCloseTo(variant.annualEffectRub + (9.9e6 + 0.4e6) * 2 / 18)
    expect(less.utilization).toBeCloseTo(0.83 * 18 / 16)
    expect(less.paybackYears).toBeCloseTo(less.capexRub / less.annualEffectRub)
  })

  it('OPEX роботов — статьи на робота: платёж RaaS, энергия и сервис масштабируются по плану', () => {
    const same = previewEconomics(variant, { robots: 18, stations: 6 })
    const more = previewEconomics(variant, { robots: 20, stations: 6 })
    expect(more.robotOpexRub - same.robotOpexRub).toBeCloseTo(same.robotOpexRub * 2 / 18)
  })

  it('строки: CAPEX, OPEX, эффект, окупаемость; изменение в процентах, «хуже» — по смыслу строки', () => {
    const rows = economicsRows(variant, { robots: 16, stations: 5 })
    expect(rows.map((r) => r.key)).toEqual(['capex', 'opex', 'effect', 'payback'])
    expect(rows[0]).toMatchObject({ from: '6,1\u00a0млн\u00a0₽', to: '5,6\u00a0млн\u00a0₽', change: { text: '−8\u00a0%', worse: false } })
    // Меньше роботов: OPEX падает, эффект растёт — оба лучше.
    expect(rows[1]?.change?.worse).toBe(false)
    expect(rows[2]?.change?.worse).toBe(false)
    const more = economicsRows(variant, { robots: 20, stations: 6 })
    expect(more[1]?.change?.worse).toBe(true)
    expect(more[2]?.change?.worse).toBe(true)
  })

  it('без изменений — изменения нет', () => {
    expect(economicsRows(variant, { robots: 18, stations: 6 }).map((r) => r.change)).toEqual([null, null, null, null])
  })
})

describe('строки итогов', () => {
  it('итог состава и доля вывезенного в пик', () => {
    const run = runOf('need_more')
    expect(kpisLine(run.before)).toBe('в худший день в срок 77,5\u00a0% · 122 из 130 рейсов в пик')
    expect(servedShare(run.before)).toBe('93,8\u00a0%')
  })
})
