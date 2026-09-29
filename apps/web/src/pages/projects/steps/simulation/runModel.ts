import type { Fleet } from '@/domain'
import type { SimulationRunProgress } from '@/services'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.run.status

type ShownProgress = Exclude<SimulationRunProgress, { status: 'error' }>

/**
 * Полоса прогона (D-103): сколько вариантов переберёт симуляция, API не знает — полоса показывает время из лимита
 * ТЗ 4.3.3. Пока идёт — не больше 99 %, чтобы полная полоса значила «готово».
 */
export function runPercent(progress: ShownProgress, limitS: number): number {
  if (progress.status === 'done') return 100
  return Math.min(99, (progress.elapsedS / limitS) * 100)
}

/**
 * Строка состояния под полосой (3.3, 16924:6): что моделируется — из состава прогона и хода задания. Число вариантов
 * API не отдаёт (D-103), поэтому варианты — одной фразой «в очереди», без счётчика.
 */
export function runStatusLine(status: ShownProgress['status'], fleet: Fleet, fromMatching: Fleet): string {
  const text = t.fleet(formatCount(fleet.robots, ru.plural.robots), formatCount(fleet.stations, ru.plural.stations))
  const isMatching = fleet.robots === fromMatching.robots && fleet.stations === fromMatching.stations
  const config = isMatching ? t.matching(text) : t.own(text)
  return status === 'running' ? t.running(config) : t.done(config)
}
