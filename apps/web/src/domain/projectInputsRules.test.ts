import { describe, expect, it } from 'vitest'
import { applyInputsPatch, emptyInputs, markFresh } from './projectInputsRules'
import type { ProjectInputs } from './projectInputs'

const AT = '2026-09-26T09:00:00.000Z'
const LATER = '2026-09-26T10:00:00.000Z'

/** Проект, дошедший до вердикта: подбор выбран, прогон есть, ничего не устарело. */
const walked: ProjectInputs = {
  params: { assumptions: [] },
  matching: { calcParams: {}, selection: { solutionId: 'RB-0008', acquisition: 'raas' }, manualSolutionIds: [] },
  simulation: { stage: 'verdict', fleet: { robots: 18, stations: 6 }, conditions: {}, runId: 'SIM-1', plan: null, acceptRisk: false },
  economics: null,
  stale: { matching: false, simulation: false },
  updatedAt: AT,
}

describe('applyInputsPatch (D-89)', () => {
  it('допущение шага 1 делает устаревшими подбор и прогон, выбор сохраняется', () => {
    const next = applyInputsPatch(walked, { params: { assumptions: [{ code: 'route_length_m', value: 86, kind: 'fact' }] } }, LATER)
    expect(next.stale).toEqual({ matching: true, simulation: true })
    expect(next.matching?.selection).toEqual({ solutionId: 'RB-0008', acquisition: 'raas' })
    expect(next.updatedAt).toBe(LATER)
  })

  it('«Параметры расчёта» делают устаревшими подбор и прогон', () => {
    const next = applyInputsPatch(walked, { matching: { calcParams: { staffCostRubPerMonth: 100_000 } } }, LATER)
    expect(next.stale).toEqual({ matching: true, simulation: true })
  })

  it('другой вариант подбора сбрасывает состав и план симуляции и требует нового прогона', () => {
    const next = applyInputsPatch(walked, { matching: { selection: { solutionId: 'RB-0001', acquisition: 'raas' } } }, LATER)
    expect(next.stale).toEqual({ matching: false, simulation: true })
    expect(next.simulation).toMatchObject({ fleet: null, plan: null, runId: 'SIM-1' })
  })

  it('состав или условия симуляции требуют нового прогона, подбор не трогают', () => {
    expect(applyInputsPatch(walked, { simulation: { fleet: { robots: 16, stations: 5 } } }, LATER).stale)
      .toEqual({ matching: false, simulation: true })
    expect(applyInputsPatch(walked, { simulation: { conditions: { repairHours: 3 } } }, LATER).stale)
      .toEqual({ matching: false, simulation: true })
  })

  it('план вердикта, этап и сценарий итога ничего не делают устаревшим', () => {
    const next = applyInputsPatch(walked, {
      simulation: { plan: { robots: 16, stations: 5 }, stage: 'run' },
      economics: { scenario: 'purchase' },
    }, LATER)
    expect(next.stale).toEqual({ matching: false, simulation: false })
    expect(next.economics).toEqual({ scenario: 'purchase' })
  })

  it('то же значение — не правка: устаревших нет', () => {
    const next = applyInputsPatch(walked, { matching: { selection: { solutionId: 'RB-0008', acquisition: 'raas' } } }, LATER)
    expect(next.stale).toEqual({ matching: false, simulation: false })
    expect(next.simulation?.fleet).toEqual({ robots: 18, stations: 6 })
  })

  it('новый прогон снимает пометку «устарело», даже если вместе с ним пришёл состав', () => {
    const stale = { ...walked, stale: { matching: false, simulation: true } }
    const next = applyInputsPatch(stale, { simulation: { runId: 'SIM-2', fleet: { robots: 15, stations: 6 } } }, LATER)
    expect(next.stale.simulation).toBe(false)
  })

  it('повторный прогон с тем же id тоже новый: запись прогона снимает пометку (D-103)', () => {
    const stale = { ...walked, stale: { matching: false, simulation: true } }
    const next = applyInputsPatch(stale, { simulation: { runId: 'SIM-1' } }, LATER)
    expect(next.stale.simulation).toBe(false)
  })

  it('новый прогон сбрасывает план и принятый риск прежнего вердикта (D-104)', () => {
    const decided = applyInputsPatch(walked, { simulation: { plan: { robots: 15, stations: 6 }, acceptRisk: true } }, LATER)
    const next = applyInputsPatch(decided, { simulation: { runId: 'SIM-2', stage: 'verdict' } }, LATER)
    expect(next.simulation).toMatchObject({ plan: null, acceptRisk: false, runId: 'SIM-2' })
  })

  it('прогон вместе с планом (сценарий /dev/screens) план не сбрасывает', () => {
    const next = applyInputsPatch(walked, { simulation: { runId: 'SIM-2', plan: { robots: 16, stations: 5 } } }, LATER)
    expect(next.simulation?.plan).toEqual({ robots: 16, stations: 5 })
  })

  it('без прогона симуляция не помечается устаревшей', () => {
    const fresh = emptyInputs(AT)
    const next = applyInputsPatch(fresh, { params: { assumptions: [{ code: 'x', value: 1, kind: 'estimate' }] } }, LATER)
    expect(next.stale).toEqual({ matching: false, simulation: false })
  })

  it('первая правка шага создаёт его с исходными значениями', () => {
    const next = applyInputsPatch(emptyInputs(AT), { simulation: { stage: 'conditions' } }, LATER)
    expect(next.simulation).toEqual({ stage: 'conditions', fleet: null, conditions: {}, runId: null, plan: null, acceptRisk: false })
    expect(applyInputsPatch(emptyInputs(AT), { economics: { scenario: 'raas' } }, LATER).economics).toEqual({ scenario: 'raas' })
  })

  it('не меняет исходный объект', () => {
    const copy = structuredClone(walked)
    applyInputsPatch(walked, { params: { assumptions: [] }, simulation: { fleet: { robots: 1, stations: 1 } } }, LATER)
    expect(walked).toEqual(copy)
  })
})

describe('markFresh', () => {
  it('новый расчёт подбора снимает пометку подбора, новый прогон — симуляции', () => {
    const stale = { ...walked, stale: { matching: true, simulation: true } }
    expect(markFresh(stale, 'matching', LATER).stale).toEqual({ matching: false, simulation: true })
    expect(markFresh(stale, 'simulation', LATER).stale).toEqual({ matching: true, simulation: false })
  })
})
