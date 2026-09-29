import type { StepperStepState } from '@/components/ui/Stepper'
import {
  SIMULATION_STAGES,
  type CalcParams,
  type Fleet,
  type RankedVariant,
  type SimulationInputs,
  type SimulationStage,
} from '@/domain'
import { formatCount, formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { PeakDemand } from '../params/paramsModel'

const c = ru.project.simulation.scope.calc
const SECONDS_PER_HOUR = 3_600

/** Границы степперов «Состав для проверки» (D-101): в PRD диапазонов нет. */
export const FLEET_LIMITS = {
  robots: { min: 1, max: 100 },
  stations: { min: 1, max: 50 },
} as const

const robotsCount = (n: number): string => formatCount(n, ru.plural.robots)

export type FleetKey = keyof Fleet

/** Поле состава (3.1): целое число в границах D-101; иначе — текст исправления. */
export function parseFleetField(key: FleetKey, text: string): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  const { min, max } = FLEET_LIMITS[key]
  const value = parseDecimal(text)
  if (value === null || !Number.isInteger(value) || value < min || value > max) return { ok: false, error: ru.project.simulation.fleet.rangeError(min, max) }
  return { ok: true, value }
}

const indexOf = (stage: SimulationStage): number => SIMULATION_STAGES.indexOf(stage)

export function isSimulationStage(value: string | null): value is SimulationStage {
  return value !== null && (SIMULATION_STAGES as readonly string[]).includes(value)
}

/** Самый дальний этап: возврат назад его не уменьшает (как шаги проекта). */
export function furthestStage(current: SimulationStage, opened: SimulationStage): SimulationStage {
  return indexOf(opened) > indexOf(current) ? opened : current
}

/**
 * Состояние этапа в степпере (D-101): «Что проверяем» открыт всегда; «Условия» — если до них доходили или был прогон;
 * «Прогон» — не ссылка, идёт по кнопке «Запустить симуляцию»; «Вердикт» — когда есть прогон.
 */
export function stageState(stage: SimulationStage, current: SimulationStage, inputs: SimulationInputs | null): StepperStepState {
  if (stage === current) return 'current'
  const reached = indexOf(inputs?.stage ?? 'scope')
  const hasRun = inputs?.runId != null
  const passed = indexOf(stage) < indexOf(current) || indexOf(stage) < reached || hasRun
  switch (stage) {
    case 'scope': return 'done'
    case 'conditions': return reached >= indexOf('conditions') || hasRun ? (passed ? 'done' : 'available') : 'locked'
    case 'run': return hasRun ? 'done' : 'locked'
    case 'verdict': return hasRun ? 'available' : 'locked'
  }
}

/** Этап — ссылкой, кроме прогона: он запускается кнопкой, а не открывается. */
export const isStageLinkable = (stage: SimulationStage): boolean => stage !== 'run'

/** Состав из подбора: роботы и станции выбранного варианта; станций расчёт не отдал — минимум, пользователь поправит. */
export function matchingFleet(variant: RankedVariant): Fleet {
  return { robots: variant.robots, stations: variant.stations ?? FLEET_LIMITS.stations.min }
}

/** Состав, равный подбору, хранится как null — «как в подборе» (PRD 11.4). */
export function fleetToStore(fleet: Fleet, fromMatching: Fleet): Fleet | null {
  return fleet.robots === fromMatching.robots && fleet.stations === fromMatching.stations ? null : fleet
}

/** «3», «3,6» — роботов на станцию. */
export const robotsPerStation = (fleet: Fleet): string => formatNumber(fleet.robots / fleet.stations, 1)

export interface CalcRow {
  readonly key: string
  readonly label: string
  readonly value: string
}

/**
 * «Расчёт подбора» (PRD 11.4, этап 1; 3.1 доски — пояснение в подписи, значение справа) на числах подбора, как в 03a (D-100):
 * потребность — хелпер шага 1, цикл и станции — из расчёта, производительность — из «Параметров расчёта» (8,6, а не 8,76
 * из PRD — №109). Строки «Парк» и «Зарядных станций» вместо «Резерв парка · роботов на станцию» с доски: резерва нет в API (D-101).
 */
export function calcRows(variant: RankedVariant, demand: PeakDemand | null, params: CalcParams | null): readonly CalcRow[] {
  const productivity = params?.robotTripsPerHour ?? null
  const rows: (CalcRow | null)[] = [
    {
      key: 'peak',
      label: c.peak,
      value: demand === null ? c.noPeak : ru.project.matching.howCalc.perHour(formatNumber(demand.perHour), demand.unit),
    },
    variant.cycleTimeS === null
      ? null
      : { key: 'cycle', label: c.withNote(c.cycle, c.cycleNote), value: ru.project.matching.howCalc.seconds(formatNumber(variant.cycleTimeS)) },
    productivity === null || variant.cycleTimeS === null || params === null
      ? null
      : {
          key: 'productivity',
          label: c.withNote(
            c.productivity,
            c.productivityNote(formatNumber(variant.cycleTimeS), formatNumber(params.utilization, 2), formatNumber(SECONDS_PER_HOUR / variant.cycleTimeS * params.utilization, 2)),
          ),
          value: ru.project.matching.howCalc.trips(formatNumber(productivity, 2)),
        },
    {
      key: 'fleet',
      label: demand && productivity ? c.withNote(c.fleet, c.fleetNote(formatNumber(demand.perHour / productivity, 1))) : c.fleet,
      value: robotsCount(variant.robots),
    },
    variant.stations === null || variant.stations === 0
      ? null
      : { key: 'stations', label: c.withNote(c.stations, c.stationsNote(robotsPerStation(matchingFleet(variant)))), value: formatNumber(variant.stations) },
  ]
  return rows.filter((r): r is CalcRow => r !== null)
}
