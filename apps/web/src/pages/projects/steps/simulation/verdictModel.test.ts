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
  planChangeLabel,
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

  it('плашка плана — от проверенного состава, числительные в родительном падеже', () => {
    expect(planChangeLabel({ robots: 18, stations: 6 }, { robots: 16, stations: 5 })).toBe('Экономия 2\u00a0роботов и 1\u00a0станции')
    expect(planChangeLabel({ robots: 15, stations: 6 }, { robots: 18, stations: 6 })).toBe('Докупка 3\u00a0роботов')
    expect(planChangeLabel({ robots: 18, stations: 6 }, { robots: 17, stations: 6 })).toBe('Экономия 1\u00a0робота')
    expect(planChangeLabel({ robots: 18, stations: 6 }, { robots: 18, stations: 6 })).toBe('Без изменений')
    expect(planChangeLabel({ robots: 18, stations: 6 }, { robots: 20, stations: 5 })).toBe('Изменение: +2\u00a0робота и −1\u00a0станция')
  })

  it('дельта строки: типографский минус, без изменения — не показывается', () => {
    expect(planDelta(16, 18)).toBe('−2')
    expect(planDelta(19, 18)).toBe('+1')
    expect(planDelta(18, 18)).toBeUndefined()
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

  it('строки таблицы: было → стало и разница со знаком', () => {
    const rows = economicsRows(variant, { robots: 16, stations: 5 })
    expect(rows.map((r) => r.key)).toEqual(['capex', 'effect', 'payback', 'utilization'])
    expect(rows[0]).toMatchObject({ from: '6,1\u00a0млн\u00a0₽', to: '5,6\u00a0млн\u00a0₽', delta: '−0,5\u00a0млн\u00a0₽' })
    expect(rows[3]).toMatchObject({ from: '83\u00a0%', to: '93\u00a0%', delta: '+10 п.п.' })
  })

  it('без изменений разница — ноль', () => {
    expect(economicsRows(variant, { robots: 18, stations: 6 }).map((r) => r.delta)).toEqual(['0', '0', '0', '0 п.п.'])
  })
})

describe('строки итогов', () => {
  it('итог состава и доля вывезенного в пик', () => {
    const run = runOf('need_more')
    expect(kpisLine(run.before)).toBe('в худший день в срок 77,5\u00a0% · 122 из 130 рейсов в пик')
    expect(servedShare(run.before)).toBe('93,8\u00a0%')
  })
})
