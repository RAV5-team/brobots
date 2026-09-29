import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import type { SimulationInputs } from '@/domain'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { findVariant } from '../matching/matchingModel'
import { calcRows, fleetToStore, furthestStage, matchingFleet, parseFleetField, stageState } from './simulationModel'

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

describe('«Расчёт подбора» — числа подбора, как в 03a (D-100, PRD 15 · №109); пояснение в подписи (16325:149)', () => {
  const rows = calcRows(amrRaas, demand, CALC_DEFAULTS_LP01)
  const row = (key: string) => rows.find((r) => r.key === key)

  it('потребность 130 паллет/ч, цикл 312 с, производительность 8,6', () => {
    expect(row('peak')?.value).toBe('130 паллет/ч')
    expect(row('cycle')).toMatchObject({ label: 'Цикл рейса (туда и обратно, погрузка и выгрузка)', value: '312 с' })
    expect(row('productivity')?.value).toBe('8,6 рейса/ч')
    expect(row('productivity')?.label).toMatch(/\(3 600 ÷ 312 × загрузка 0,75 ≈ 8,65\)$/)
  })

  it('парк 18 роботов: 15,1 без резерва; станций 6 — 1 на 3 робота', () => {
    expect(row('fleet')?.value).toMatch(/^18\sроботов$/u)
    expect(row('fleet')?.label).toMatch(/^Парк \(15,1 без резерва/)
    expect(row('stations')).toMatchObject({ label: 'Зарядных станций (1 на 3 робота)', value: '6' })
  })

  it('без потребности — «нет данных», парк без формулы', () => {
    const bare = calcRows(amrRaas, null, CALC_DEFAULTS_LP01)
    expect(bare.find((r) => r.key === 'peak')?.value).toMatch(/нет данных/)
    expect(bare.find((r) => r.key === 'fleet')?.label).toBe('Парк')
  })
})

describe('поле состава 3.1 — целое число в границах D-101', () => {
  it('принимает целое в границах', () => {
    expect(parseFleetField('robots', '24')).toEqual({ ok: true, value: 24 })
    expect(parseFleetField('stations', ' 50 ')).toEqual({ ok: true, value: 50 })
  })

  it('дробь, пусто и выход за границы — текст исправления', () => {
    const error = { ok: false, error: 'Введите целое число от 1 до 100' }
    expect(parseFleetField('robots', '18,5')).toEqual(error)
    expect(parseFleetField('robots', '')).toEqual(error)
    expect(parseFleetField('robots', '0')).toEqual(error)
    expect(parseFleetField('stations', '51')).toEqual({ ok: false, error: 'Введите целое число от 1 до 50' })
  })
})
