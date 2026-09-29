import type { Fleet } from '@/domain'
import type { SimulationRunProgress } from '@/services'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.run.status

type ShownProgress = Exclude<SimulationRunProgress, { status: 'error' }>

/** Строка журнала шагов (3.3): сделано, идёт сейчас, ещё в очереди. */
export interface RunStep {
  readonly text: string
  readonly state: 'done' | 'current' | 'queued'
}

/** Последняя строка журнала уже про вердикт — очередь вариантов больше не обещаем. */
const VERDICT = /вердикт/iu

/**
 * Полоса прогона (D-103): сколько вариантов переберёт симуляция, API не знает — полоса показывает время из лимита
 * ТЗ 4.3.3. Пока идёт — не больше 99 %, чтобы полная полоса значила «готово».
 */
export function runPercent(progress: ShownProgress, limitS: number): number {
  if (progress.status === 'done') return 100
  return Math.min(99, (progress.elapsedS / limitS) * 100)
}

function configOf(fleet: Fleet, fromMatching: Fleet): string {
  const text = t.fleet(formatCount(fleet.robots, ru.plural.robots), formatCount(fleet.stations, ru.plural.stations))
  const isMatching = fleet.robots === fromMatching.robots && fleet.stations === fromMatching.stations
  return isMatching ? t.matching(text) : t.own(text)
}

/**
 * Журнал шагов под полосой (3.3, 17385:2606). Строки задания — как пришли: уже показанные сделаны,
 * последняя идёт сейчас. Пока журнал пуст — шаг про состав и очередь вариантов. Готовый прогон — все строки сделаны.
 * Число вариантов API не отдаёт (D-103), поэтому очередь — одна фраза, без счётчика.
 */
export function runSteps(progress: ShownProgress, fleet: Fleet | null, fromMatching: Fleet | null): readonly RunStep[] {
  const lines = progress.log
  if (progress.status === 'done') {
    if (lines.length > 0) return lines.map((text) => ({ text, state: 'done' }))
    return fleet && fromMatching ? [{ text: t.done(configOf(fleet, fromMatching)), state: 'done' }] : []
  }
  if (lines.length === 0) {
    if (!fleet || !fromMatching) return []
    return [
      { text: t.modeling(configOf(fleet, fromMatching)), state: 'current' },
      { text: t.queued, state: 'queued' },
    ]
  }
  const done = lines.slice(0, -1).map((text): RunStep => ({ text, state: 'done' }))
  const current = lines[lines.length - 1] ?? ''
  const queued: readonly RunStep[] = VERDICT.test(current) ? [] : [{ text: t.queued, state: 'queued' }]
  return [...done, { text: current, state: 'current' }, ...queued]
}
