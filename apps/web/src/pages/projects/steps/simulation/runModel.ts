import type { ProgressLogLine } from '@/components/ui/ProgressPanel'
import type { SimulationRunProgress } from '@/services'

type ShownProgress = Exclude<SimulationRunProgress, { status: 'error' }>

/**
 * Полоса прогона (D-103): сколько вариантов переберёт симуляция, API не знает — полоса показывает время из лимита
 * ТЗ 4.3.3. Пока идёт — не больше 99 %, чтобы полная полоса значила «готово».
 */
export function runPercent(progress: ShownProgress, limitS: number): number {
  if (progress.status === 'done') return 100
  return Math.min(99, (progress.elapsedS / limitS) * 100)
}

/** Журнал строками: пока идёт — последняя строка текущая, до первой строки — «ставим в очередь»; готово — всё ✓. */
export function runLogLines(progress: ShownProgress, queued: string): readonly ProgressLogLine[] {
  if (progress.status === 'done') return progress.log.map((text) => ({ text, state: 'done' }))
  if (progress.log.length === 0) return [{ text: queued, state: 'current' }]
  const last = progress.log.length - 1
  return progress.log.map((text, i) => ({ text, state: i === last ? 'current' : 'done' }))
}
