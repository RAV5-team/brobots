import type { Project, ProjectStep } from './project'
import type { ProjectInputs, ProjectInputsPatch } from './projectInputs'

/** Четыре шага проекта по PRD 0.9 — порядок степпера. */
export const PROJECT_STEPS: readonly ProjectStep[] = ['params', 'matching', 'simulation', 'economics']

const indexOf = (step: ProjectStep): number => PROJECT_STEPS.indexOf(step)

/** Сохранённая оценка — только просмотр (D-17). */
export const isReadOnly = (project: Project): boolean => project.status === 'saved'

/** Черновик — пройденные шаги и текущий; сохранённая оценка — все шаги. URL и степпер дальше не пускают. */
export function canOpenStep(project: Project, step: ProjectStep): boolean {
  return project.status === 'saved' || indexOf(step) <= indexOf(project.step)
}

/**
 * Кнопка шага («Подобрать решения», «Перейти к симуляции», принять вердикт) открывает ровно следующий.
 * Прямой URL этого шага по-прежнему закрыт, пока `openStep` не запишет его в черновик.
 */
export function canAdvanceTo(project: Project, step: ProjectStep): boolean {
  return project.status === 'draft' && indexOf(step) === indexOf(project.step) + 1
}

/** Состояние шага в степпере: `current` — открытый сейчас, `available` — открыть можно, но ещё не завершён. */
export type StepState = 'done' | 'current' | 'available' | 'locked'

export function stepState(project: Project, step: ProjectStep, openStep: ProjectStep): StepState {
  if (step === openStep) return 'current'
  if (!canOpenStep(project, step)) return 'locked'
  if (project.status === 'saved' || indexOf(step) < indexOf(project.step)) return 'done'
  return 'available'
}

/** Самый дальний шаг черновика после CTA: возврат назад по степперу его не уменьшает. */
export function furthestStep(current: ProjectStep, opened: ProjectStep): ProjectStep {
  return indexOf(opened) > indexOf(current) ? opened : current
}

/** Сжать дальний шаг, не продвигая вперёд: правки, из-за которых подбор устарел. */
export function rewindStep(current: ProjectStep, floor: ProjectStep): ProjectStep {
  return indexOf(current) < indexOf(floor) ? current : floor
}

/** Почему подбор устарел: допущения шага 1 или «Параметры расчёта». */
export function matchingStaleCause(patch: ProjectInputsPatch, next: ProjectInputs): 'params' | 'calcParams' | null {
  if (!next.stale.matching) return null
  if (patch.params !== undefined && 'assumptions' in patch.params) return 'params'
  if (patch.matching !== undefined && 'calcParams' in patch.matching) return 'calcParams'
  return null
}

/** Устаревший подбор закрывает шаги вперёд: допущения — на параметры, «Параметры расчёта» — на подбор. */
export function stepAfterMatchingStale(current: ProjectStep, cause: 'params' | 'calcParams' | null): ProjectStep {
  if (cause === 'params') return rewindStep(current, 'params')
  if (cause === 'calcParams') return rewindStep(current, 'matching')
  return current
}
