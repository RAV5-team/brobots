import { describe, expect, it } from 'vitest'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import type { SimulationSchemas } from '../contract'
import { toSimulationJob, toSimulationRun } from './simulation'

const confirmed = SIMULATION_RUNS.find((run) => run.status === 'confirmed') as SimulationSchemas['SimulationRun']

describe('toSimulationRun', () => {
  it('вердикты API переводятся в вердикты PRD 11.4', () => {
    const verdicts = SIMULATION_RUNS.map((run) => toSimulationRun(run).verdict)
    expect(verdicts).toEqual(['confirmed', 'can_reduce', 'need_more', 'layout_bottleneck', 'unreachable'])
  })

  it('итог прогона: состав, пик, худший день, тексты вердикта, почасовые строки', () => {
    const run = toSimulationRun(confirmed)
    expect(run).toMatchObject({
      id: 'SIM-0926-01',
      from: { robots: 18, stations: 6 },
      to: { robots: 18, stations: 6 },
      peak: { requiredPerHour: 130, servedPerHour: 130 },
      onTimeWorstDay: 0.984,
    })
    expect(run.title).not.toBe('')
    expect(run.hourlyAfter).toHaveLength(24)
    expect(run.hourlyAfter[0]).toHaveProperty('working')
  })

  it('итоги проверенного состава — из kpis_before, итогового — из kpis', () => {
    const needMore = SIMULATION_RUNS.find((r) => r.status === 'needs_additions') as SimulationSchemas['SimulationRun']
    const run = toSimulationRun(needMore)
    expect(run.before).toEqual({ peak: { requiredPerHour: 130, servedPerHour: 122 }, onTimeWorstDay: 0.775, utilizationPeak: 0.99, fleetShares: needMore.kpis_before.fleet_shares })
    expect(run.peak.servedPerHour).toBe(130)
    expect(run.fleetShares).toEqual(needMore.kpis.fleet_shares)
    expect(Object.values(run.fleetShares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2)
  })

  it('вердикт без заголовка — ошибка контракта', () => {
    const broken = { ...confirmed, verdict: { lines: [] } as unknown as SimulationSchemas['SimulationRun']['verdict'] }
    expect(() => toSimulationRun(broken)).toThrow('SimulationRun.verdict: в ответе нет строки «title»')
  })

  it('статус вне перечня — ошибка контракта', () => {
    const broken = { ...confirmed, status: 'maybe' as 'confirmed' }
    expect(() => toSimulationRun(broken)).toThrow(/«maybe» не входит в перечень/)
  })
})

describe('toSimulationJob', () => {
  it('задание: ход, журнал, id готового прогона', () => {
    expect(toSimulationJob({ job_id: 'J-1', status: 'done', log: ['готово'], elapsed: 4.2, simulation_ids: ['SIM-1'] }))
      .toEqual({ id: 'J-1', status: 'done', log: ['готово'], elapsedS: 4.2, runId: 'SIM-1', error: null })
    expect(toSimulationJob({ job_id: 'J-2', status: 'running', log: [], elapsed: 1 }).runId).toBeNull()
  })
})
