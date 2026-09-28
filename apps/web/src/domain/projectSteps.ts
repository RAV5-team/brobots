import type { Project, ProjectStep } from './project'

/** Четыре шага проекта по PRD 0.9 — порядок степпера. */
export const PROJECT_STEPS: readonly ProjectStep[] = ['params', 'matching', 'simulation', 'economics']

const indexOf = (step: ProjectStep): number => PROJECT_STEPS.indexOf(step)

/** Сохранённая оценка — только просмотр (D-17). */
export const isReadOnly = (project: Project): boolean => project.status === 'saved'

/** Черновик — пройденные шаги и текущий; сохранённая оценка — все шаги. */
export function canOpenStep(project: Project, step: ProjectStep): boolean {
  return project.status === 'saved' || indexOf(step) <= indexOf(project.step)
}

/** Состояние шага в степпере: `current` — открытый сейчас, `available` — открыть можно, но ещё не завершён. */
export type StepState = 'done' | 'current' | 'available' | 'locked'

export function stepState(project: Project, step: ProjectStep, openStep: ProjectStep): StepState {
  if (step === openStep) return 'current'
  if (!canOpenStep(project, step)) return 'locked'
  if (project.status === 'saved' || indexOf(step) < indexOf(project.step)) return 'done'
  return 'available'
}

/** Самый дальний шаг черновика после перехода: возврат назад его не уменьшает. */
export function furthestStep(current: ProjectStep, opened: ProjectStep): ProjectStep {
  return indexOf(opened) > indexOf(current) ? opened : current
}
