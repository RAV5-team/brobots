import type { HourlyStat, SimulationAdjustment, SimulationJob, SimulationRun, SimulationVerdict } from '@/domain'
import { ContractError, oneOf, optional, type SimulationSchemas } from '../contract'

type RunDto = SimulationSchemas['SimulationRun']

/** Вердикты services/simulation → вердикты PRD 11.4. */
const VERDICTS: Record<RunDto['status'], SimulationVerdict> = {
  confirmed: 'confirmed',
  can_reduce: 'can_reduce',
  needs_additions: 'need_more',
  layout_bottleneck: 'layout_bottleneck',
  not_achievable: 'unreachable',
}

function toHourly(row: SimulationSchemas['HourlyRow']): HourlyStat {
  return {
    hour: row.clock,
    demand: row.demand,
    done: row.done,
    onTime: row.on_time,
    waitMeanMin: row.wait_mean_min,
    working: row.work,
    charging: row.charge,
    waitingCharger: row.wait_charger,
    down: row.down,
    idle: row.idle,
    utilization: row.util,
    backlogMax: row.backlog_max,
    chargersBusy: row.chargers_busy,
  }
}

function toAdjustment(dto: SimulationSchemas['Adjustment']): SimulationAdjustment {
  return {
    code: dto.code,
    group: oneOf(dto.group, ['fleet', 'coefficient'], 'Adjustment.group'),
    label: dto.label,
    base: dto.base,
    simulated: dto.simulated,
    unit: dto.unit,
    apply: oneOf(dto.apply, ['override', 'calibration'], 'Adjustment.apply'),
    note: dto.note,
    deltaRel: dto.delta_rel,
    significant: dto.significant,
    defaultSelected: dto.default_selected,
  }
}

/** Тексты вердикта (simcore/verdict_text.verdict). Схема описывает их, но ответ проверяем: экран без заголовка пуст. */
function verdictText(verdict: RunDto['verdict']): Pick<SimulationRun, 'title' | 'lines' | 'justification' | 'risks'> {
  const entity = 'SimulationRun.verdict'
  const raw: Partial<Record<keyof RunDto['verdict'], unknown>> = verdict
  if (typeof raw.title !== 'string') throw new ContractError(`${entity}: в ответе нет строки «title»`)
  const list = (key: 'lines' | 'justification' | 'risks'): readonly string[] => {
    const value = raw[key] ?? []
    if (!Array.isArray(value) || !value.every((line): line is string => typeof line === 'string')) {
      throw new ContractError(`${entity}: «${key}» — не список строк`)
    }
    return value
  }
  return { title: raw.title, lines: list('lines'), justification: list('justification'), risks: list('risks') }
}

/** Прогон services/simulation → прогон экрана (этап 4 и «Графики и 2D»). */
export function toSimulationRun(dto: RunDto): SimulationRun {
  const status = oneOf(dto.status, Object.keys(VERDICTS) as RunDto['status'][], 'SimulationRun.status')
  const { from_: from, to } = dto.fleet_change
  return {
    id: dto.simulation_id,
    verdict: VERDICTS[status],
    label: dto.label,
    ...verdictText(dto.verdict),
    diagnosis: dto.diagnosis,
    from: { robots: from.robots, stations: from.chargers },
    to: { robots: to.robots, stations: to.chargers },
    peak: { requiredPerHour: dto.kpis.throughput.required_h, servedPerHour: dto.kpis.throughput.served_h },
    onTimeWorstDay: dto.kpis.on_time_min,
    utilizationPeak: dto.kpis.util_peak,
    fleetShares: dto.kpis.fleet_shares,
    before: {
      peak: { requiredPerHour: dto.kpis_before.throughput.required_h, servedPerHour: dto.kpis_before.throughput.served_h },
      onTimeWorstDay: dto.kpis_before.on_time_min,
      utilizationPeak: dto.kpis_before.util_peak,
      fleetShares: dto.kpis_before.fleet_shares,
    },
    hourlyBefore: dto.hourly_before.map(toHourly),
    hourlyAfter: dto.hourly_after.map(toHourly),
    warnings: dto.warnings,
    adjustments: dto.adjusted_input_set.items.map(toAdjustment),
  }
}

/** Задание на прогон → ход этапа 3. */
export function toSimulationJob(dto: SimulationSchemas['Job']): SimulationJob {
  return {
    id: dto.job_id,
    status: dto.status,
    log: dto.log,
    elapsedS: dto.elapsed,
    runId: dto.status === 'done' ? optional(dto.simulation_ids?.[0]) : null,
    error: optional(dto.error),
  }
}
