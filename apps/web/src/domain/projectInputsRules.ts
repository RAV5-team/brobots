import type { IsoDateTime } from './common'
import type {
  EconomicsInputs,
  MatchingInputs,
  ProjectInputs,
  ProjectInputsPatch,
  SimulationInputs,
} from './projectInputs'

const EMPTY_MATCHING: MatchingInputs = { calcParams: {}, selection: null, manualSolutionIds: [] }
const EMPTY_SIMULATION: SimulationInputs = {
  stage: 'scope',
  fleet: null,
  conditions: {},
  runId: null,
  plan: null,
  acceptRisk: false,
}
const DEFAULT_ECONOMICS: EconomicsInputs = { scenario: 'raas' }

/** Решения нового черновика: шаг 1 пуст, дальше ничего не пройдено. */
export function emptyInputs(at: IsoDateTime): ProjectInputs {
  return {
    params: { assumptions: [] },
    matching: null,
    simulation: null,
    economics: null,
    stale: { matching: false, simulation: false },
    updatedAt: at,
  }
}

/** Без выбора поправок методики: его делал пользователь по прежнему прогону. */
function withoutCalibration(simulation: SimulationInputs): SimulationInputs {
  const { calibration, ...rest } = simulation
  return calibration === undefined ? simulation : rest
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Поле правки задано и отличается от текущего значения. */
function changed<T extends object>(current: T | null, patch: Partial<T> | undefined, key: keyof T): boolean {
  return patch !== undefined && key in patch && !same(current?.[key], patch[key])
}

/**
 * Применить правку решений и отметить, что устарело (D-89, proposed — в PRD правила нет):
 * допущения шага 1 и «Параметры расчёта» → подбор и прогон; другой вариант подбора → прогон, состав и план сбрасываются;
 * состав и условия симуляции → прогон; новый прогон снимает пометку и сбрасывает план, риск и выбор поправок методики прежнего вердикта.
 * План вердикта, выбор поправок методики, этап и сценарий итога ничего не делают устаревшим.
 */
export function applyInputsPatch(inputs: ProjectInputs, patch: ProjectInputsPatch, at: IsoDateTime): ProjectInputs {
  const matchingInputsChanged = changed(inputs.params, patch.params, 'assumptions')
    || changed(inputs.matching, patch.matching, 'calcParams')
  const selectionChanged = changed(inputs.matching, patch.matching, 'selection')
  const simulationInputsChanged = changed(inputs.simulation, patch.simulation, 'fleet')
    || changed(inputs.simulation, patch.simulation, 'conditions')

  const matching = patch.matching ? { ...(inputs.matching ?? EMPTY_MATCHING), ...patch.matching } : inputs.matching
  const simulationBase = patch.simulation ? { ...(inputs.simulation ?? EMPTY_SIMULATION), ...patch.simulation } : inputs.simulation
  // Состав и план считались для прежнего варианта — после смены варианта их берут из нового подбора.
  const selected = selectionChanged && simulationBase ? { ...simulationBase, fleet: null, plan: null } : simulationBase
  // План и принятый риск — решения по прежнему вердикту: новый прогон подставляет свою рекомендацию (D-104).
  const rerun = patch.simulation?.runId != null && !('plan' in patch.simulation)
  const replanned = rerun && selected ? { ...selected, plan: null, acceptRisk: false } : selected
  // Поправки методики предлагает прогон: новый прогон — новые поправки, прежний выбор не переносится.
  const recalibrate = patch.simulation?.runId != null && !('calibration' in patch.simulation)
  const simulation = recalibrate && replanned ? withoutCalibration(replanned) : replanned
  const economics = patch.economics ? { ...(inputs.economics ?? DEFAULT_ECONOMICS), ...patch.economics } : inputs.economics

  // Прогона не было — устаревать нечему. Записать прогон — значит прогнать заново: пометку снимает и тот же id
  // (прогон по тем же составу и условиям, мок отдаёт одну фикстуру; D-103).
  const hasRun = simulation?.runId != null
  const newRun = patch.simulation?.runId != null
  return {
    params: patch.params ? { ...inputs.params, ...patch.params } : inputs.params,
    matching,
    simulation,
    economics,
    stale: {
      matching: inputs.stale.matching || (matchingInputsChanged && matching !== null),
      simulation: !newRun && (inputs.stale.simulation || (hasRun && (matchingInputsChanged || selectionChanged || simulationInputsChanged))),
    },
    updatedAt: at,
  }
}

/** Новый расчёт подбора или новый прогон симуляции снимает пометку «устарело» с этого шага. */
export function markFresh(inputs: ProjectInputs, step: 'matching' | 'simulation', at: IsoDateTime): ProjectInputs {
  return { ...inputs, stale: { ...inputs.stale, [step]: false }, updatedAt: at }
}
