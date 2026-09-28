import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import type { SimulationInputs } from '@/domain'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { findVariant } from '../matching/matchingModel'
import { calcRows, fleetToStore, furthestStage, matchingFleet, stageState } from './simulationModel'

const evaluation = toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01)
const amrRaas = findVariant(evaluation, 'RB-0008', 'raas')
if (!amrRaas) throw new Error('нет AMR 800 · RaaS в фикстуре')
const demand = { perDay: 2000, hours: 22, peakFactor: 1.5, share: 0.95, perHour: 2000 / 22 * 1.5 * 0.95, unit: 'паллет' }
const inputs = (patch: Partial<SimulationInputs>): SimulationInputs =>
  ({ stage: 'scope', fleet: null, conditions: {}, runId: null, plan: null, acceptRisk: false, ...patch })

describe('этапы симуляции (D-101)', () => {
  it('новый черновик: открыт только этап 1', () => {
    expect(['scope', 'conditions', 'run', 'verdict'].map((s) => stageState(s as never, 'scope', null))).toEqual(['current', 'locked', 'locked', 'locked'])
  })

  it('дошли до условий — условия доступны, прогон и вердикт закрыты', () => {
    const i = inputs({ stage: 'conditions' })
    expect(stageState('conditions', 'scope', i)).toBe('available')
    expect(stageState('run', 'scope', i)).toBe('locked')
    expect(stageState('verdict', 'scope', i)).toBe('locked')
  })

  it('есть прогон — открыт вердикт, прогон пройден', () => {
    const i = inputs({ stage: 'verdict', runId: 'SIM-1' })
    expect(stageState('conditions', 'scope', i)).toBe('done')
    expect(stageState('run', 'scope', i)).toBe('done')
    expect(stageState('verdict', 'scope', i)).toBe('available')
  })

  it('возврат назад не уменьшает самый дальний этап', () => {
    expect(furthestStage('verdict', 'scope')).toBe('verdict')
    expect(furthestStage('scope', 'conditions')).toBe('conditions')
  })
})

describe('состав для проверки (PRD 11.4)', () => {
  it('по умолчанию — как в подборе: 18 роботов, 6 станций', () => {
    expect(matchingFleet(amrRaas)).toEqual({ robots: 18, stations: 6 })
  })

  it('состав, равный подбору, хранится как null', () => {
    const from = matchingFleet(amrRaas)
    expect(fleetToStore({ robots: 18, stations: 6 }, from)).toBeNull()
    expect(fleetToStore({ robots: 15, stations: 6 }, from)).toEqual({ robots: 15, stations: 6 })
  })
})

describe('«Как рассчитал подбор» — числа подбора, как в 03a (D-100, PRD 15 · №109)', () => {
  const rows = calcRows(amrRaas, demand, CALC_DEFAULTS_LP01)
  const value = (key: string) => rows.find((r) => r.key === key)?.value

  it('потребность 130 паллет/ч, цикл 312 с, производительность 8,6', () => {
    expect(value('peak')).toBe('130 паллет/ч')
    expect(value('cycle')).toMatch(/^312 с · /)
    expect(value('productivity')).toMatch(/^8,6 рейса\/ч · 3 600 ÷ 312 × загрузка 0,75 ≈ 8,65/)
  })

  it('парк 18 роботов: 15,1 без резерва; станций 6 — 1 на 3 робота', () => {
    expect(value('fleet')).toMatch(/^18\sроботов · 15,1 без резерва/u)
    expect(value('stations')).toBe('6 · 1 на 3 робота')
  })

  it('без потребности — «нет данных», парк без формулы', () => {
    const bare = calcRows(amrRaas, null, CALC_DEFAULTS_LP01)
    expect(bare.find((r) => r.key === 'peak')?.value).toMatch(/нет данных/)
    expect(bare.find((r) => r.key === 'fleet')?.value).toMatch(/^18\sроботов$/u)
  })
})
