import { projectStepPath } from '@/app/routePaths'
import type { SimulationVerdict } from '@/domain'
import type { ScreenScenario } from './types'

/** Прогоны демо-проекта по вердиктам — синтетические фикстуры simulationRuns.generated.ts. */
const RUN_BY_VERDICT: Readonly<Record<SimulationVerdict, string>> = {
  confirmed: 'SIM-0926-01',
  can_reduce: 'SIM-0926-02',
  need_more: 'SIM-0926-03',
  layout_bottleneck: 'SIM-0926-04',
  unreachable: 'SIM-0926-05',
}

/** 07: демо-проект с прогоном нужного вердикта; `charts` — сразу вкладка «Графики и 2D-сравнение» (07a). */
const simulationVerdict = (verdict: SimulationVerdict, tab: 'verdict' | 'charts' = 'verdict'): ScreenScenario => async (services) => {
  const run = await services.projects.getSimulationRun(RUN_BY_VERDICT[verdict])
  await services.projects.updateInputs('PJ-DEMO', { simulation: { stage: 'verdict', fleet: run.from, plan: run.to, runId: run.id, acceptRisk: false } })
  const path = projectStepPath('PJ-DEMO', 'simulation')
  return { to: tab === 'charts' ? `${path}?stage=verdict&tab=charts` : path, state: null }
}

/** Шаг 3: вердикты 07 (состав как у проверенного в прогоне, этап «Вердикт») и вкладка графиков 07a. */
export const SIMULATION_SCENARIOS: Readonly<Record<string, ScreenScenario>> = {
  'proto-07-confirmed': simulationVerdict('confirmed'),
  'proto-07-can-reduce': simulationVerdict('can_reduce'),
  'proto-07-need-more': simulationVerdict('need_more'),
  'proto-07-layout': simulationVerdict('layout_bottleneck'),
  'proto-07-unreachable': simulationVerdict('unreachable'),
  'proto-07a': simulationVerdict('can_reduce', 'charts'),
}
