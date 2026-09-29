import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { toSimulationRun } from '@/api/mappers/simulation'
import { LOCATION_PROCESSES } from './locationProcesses'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01, EVALUATIONS_BY_PROCESS } from './projectMatching'
import { PROCESSES } from './processes'
import { DEMO_PROJECT, PROJECT_LOCAL_STATE, PROJECTS } from './projects'
import { ROBOTS } from './robots'
import { SIMULATION_RUNS } from './simulationRuns.generated'

const matching = toMatchingEvaluation(EVALUATION_LP01)
const runs = SIMULATION_RUNS.map(toSimulationRun)
const run = (verdict: string) => {
  const found = runs.find((r) => r.verdict === verdict)
  if (!found) throw new Error(`нет прогона ${verdict}`)
  return found
}

describe('фикстуры проекта: связность', () => {
  it('все решения подбора есть в каталоге', () => {
    const ids = new Set<string>(ROBOTS.map((r) => r.id))
    const solutions = [...matching.variants.map((v) => v.solutionId), ...matching.excluded.map((e) => e.solutionId)]
    expect(solutions.filter((id) => !ids.has(id))).toEqual([])
  })

  it('подбор привязан к существующему процессу локации', () => {
    const processIds = new Set(LOCATION_PROCESSES.map((lp) => lp.id))
    expect(Object.keys(EVALUATIONS_BY_PROCESS).filter((id) => !processIds.has(id as `LP-${string}`))).toEqual([])
  })

  it('выбранный вариант каждого проекта есть в рейтинге его процесса', () => {
    for (const project of [...PROJECTS, DEMO_PROJECT]) {
      const selection = project.inputs.matching?.selection
      if (!selection) continue
      const evaluation = EVALUATIONS_BY_PROCESS[project.locationProcessId ?? '']
      expect(evaluation, project.id).toBeDefined()
      const variants = toMatchingEvaluation(evaluation ?? EVALUATION_LP01).variants
      expect(variants.some((v) => v.solutionId === selection.solutionId && v.acquisition === selection.acquisition), project.id).toBe(true)
    }
  })

  it('снимок сохранённой оценки равен выбранному сценарию подбора (D-81: одни числа везде)', () => {
    for (const project of PROJECTS) {
      const selection = project.inputs.matching?.selection
      if (project.status !== 'saved' || !selection) continue
      const scenario = project.inputs.economics?.scenario ?? selection.acquisition
      const variant = matching.variants.find((v) => v.solutionId === selection.solutionId && v.acquisition === scenario)
      expect({ ...project.result }, project.id).toEqual({
        capexRub: variant?.capexRub, opexRubPerYear: variant?.opexRubPerYear, paybackYears: variant?.paybackYears, annualEffectRub: variant?.annualEffectRub,
      })
    }
  })

  it('прогон проекта совпадает с составом подбора: 18 роботов и 6 станций', () => {
    const recommended = matching.variants.find((v) => v.rank === 1)
    const runId = PROJECT_LOCAL_STATE['PJ-DEMO']?.inputs.simulation?.runId
    expect(runs.find((r) => r.id === runId)?.from).toEqual({ robots: recommended?.robots, stations: recommended?.stations })
  })

  it('PJ-07 «Инвентаризация» — на «Параметрах»: подбор заблокирован (PRD 11.2 главнее примера 11.1, README)', () => {
    expect(PROJECTS.find((p) => p.id === 'PJ-07')).toMatchObject({ status: 'draft', step: 'params' })
  })
})

describe('синтетические прогоны сходятся с итогами PRD 11.4–11.5', () => {
  it('пять вердиктов, по одному прогону', () => {
    expect(runs.map((r) => r.verdict)).toEqual(['confirmed', 'can_reduce', 'need_more', 'layout_bottleneck', 'unreachable'])
  })

  it('основной прогон: 130 из 130 в пик, в срок 98,4 % в худший день, загрузка в пик 83 %', () => {
    const confirmed = run('confirmed')
    expect(confirmed.peak).toEqual({ requiredPerHour: 130, servedPerHour: 130 })
    expect(confirmed.onTimeWorstDay).toBe(0.984)
    expect(confirmed.utilizationPeak).toBeCloseTo(0.83, 2)
    const demand = confirmed.hourlyAfter.reduce((sum, h) => sum + h.demand, 0)
    const onTime = confirmed.hourlyAfter.reduce((sum, h) => sum + h.demand * (h.onTime ?? 1), 0) / demand
    expect(demand).toBe(1900)
    expect(onTime).toBeCloseTo(0.984, 3)
    expect(Math.max(...confirmed.hourlyAfter.map((h) => h.demand))).toBe(130)
  })

  it('«нужно докупить»: 15/6 вывозят 122 из 130 (94,0 %), после докупки — 18/6', () => {
    const needMore = run('need_more')
    expect(needMore.from).toEqual({ robots: 15, stations: 6 })
    expect(needMore.to).toEqual({ robots: 18, stations: 6 })
    expect(Math.min(...needMore.hourlyBefore.filter((h) => h.demand === 130).map((h) => h.done))).toBe(122)
  })

  it('«можно уменьшить»: 18 → 16 роботов, как на макете 07', () => {
    expect(run('can_reduce')).toMatchObject({ from: { robots: 18 }, to: { robots: 16 }, peak: { servedPerHour: 130 } })
  })

  it('роботы в состояниях не превышают парк ни в один час', () => {
    for (const r of runs) {
      for (const h of [...r.hourlyBefore, ...r.hourlyAfter]) {
        const fleet = r.hourlyAfter.includes(h) ? r.to.robots : r.from.robots
        expect(h.working + h.charging + h.waitingCharger + h.down + h.idle, `${r.id} ${String(h.hour)}`).toBeCloseTo(fleet, 1)
      }
    }
  })
})

describe('поправки методики прогонов (3.4)', () => {
  const amr800 = matching.variants.find((v) => v.solutionId === 'RB-0008' && v.acquisition === 'raas')
  const lp01 = LOCATION_PROCESSES.find((lp) => lp.id === 'LP-01')
  const routeLength = lp01?.overrides.routeLengthM ?? PROCESSES.find((p) => p.code === lp01?.processCode)?.defaults.routeLengthM

  it('нормативы — из расчёта подбора (D-101): загрузка 0,75, 8,6 рейса/ч, цикл 312 с, рейс процесса LP-01', () => {
    for (const r of runs) {
      const byCode = Object.fromEntries(r.adjustments.map((a) => [a.code, a.base]))
      expect(byCode, r.id).toEqual({
        n_util: CALC_DEFAULTS_LP01.utilization,
        route_len_m: routeLength,
        cycle_s: amr800?.cycleTimeS,
        eff_prod: CALC_DEFAULTS_LP01.robotTripsPerHour,
      })
    }
  })

  it('значима поправка с отклонением больше допуска 10 %; по умолчанию калибровка не выбрана (simcore/adjustments.py)', () => {
    for (const a of runs.flatMap((r) => r.adjustments)) {
      expect(a.deltaRel).toBeCloseTo(((a.simulated ?? 0) - (a.base ?? 1)) / (a.base ?? 1), 3)
      expect(a.significant).toBe(Math.abs(a.deltaRel ?? 0) > 0.1)
      expect(a).toMatchObject({ group: 'coefficient', apply: 'calibration', defaultSelected: false })
    }
  })
})

describe('процесс LP-04 «Уборка склада»', () => {
  it('кратность уборки — 2 раза в сутки (допущение доски 16325, README)', () => {
    expect(LOCATION_PROCESSES.find((lp) => lp.id === 'LP-04')?.overrides.cleaningsPerDay).toBe(2)
  })
})
