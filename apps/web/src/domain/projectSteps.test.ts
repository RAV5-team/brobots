import { describe, expect, it } from 'vitest'
import {
  canAdvanceTo, canOpenStep, furthestStep, isReadOnly, matchingStaleCause, PROJECT_STEPS, rewindStep,
  stepAfterMatchingStale, stepState,
} from './projectSteps'
import type { Project, ProjectStep } from './project'
import { applyInputsPatch, emptyInputs } from './projectInputsRules'

const base = {
  id: 'PJ-X', name: 'x', locationId: 'LOC-01', locationProcessId: 'LP-01', updatedAt: '2026-09-26T09:00:00Z',
  versions: { snapshotAt: '2026-09-15', catalog: 4, model: '2.1', norms: 1 }, inputs: emptyInputs('2026-09-26T09:00:00Z'),
} as const

const draftAt = (step: ProjectStep): Project => ({ ...base, status: 'draft', step })

const saved: Project = {
  ...base, status: 'saved', savedAt: '2026-09-26T09:00:00Z',
  result: { capexRub: 1, opexRubPerYear: 1, paybackYears: 1, annualEffectRub: 1 },
}

describe('шаги проекта', () => {
  it('четыре шага по PRD 0.9', () => {
    expect(PROJECT_STEPS).toEqual(['params', 'matching', 'simulation', 'economics'])
  })

  it('черновик открывает пройденные шаги и текущий, дальше — нет', () => {
    const draft = draftAt('matching')
    expect(PROJECT_STEPS.map((s) => canOpenStep(draft, s))).toEqual([true, true, false, false])
  })

  it('кнопка CTA открывает только следующий шаг, не через один', () => {
    const draft = draftAt('params')
    expect(PROJECT_STEPS.map((s) => canAdvanceTo(draft, s))).toEqual([false, true, false, false])
    expect(canAdvanceTo(draftAt('matching'), 'simulation')).toBe(true)
    expect(canAdvanceTo(saved, 'economics')).toBe(false)
  })

  it('сохранённая оценка открывает все шаги, только просмотр (D-17)', () => {
    expect(PROJECT_STEPS.every((s) => canOpenStep(saved, s))).toBe(true)
    expect(isReadOnly(saved)).toBe(true)
    expect(isReadOnly(draftAt('params'))).toBe(false)
  })

  it('состояние шага для степпера: пройден, текущий, доступен, закрыт', () => {
    const draft = draftAt('simulation')
    expect(PROJECT_STEPS.map((s) => stepState(draft, s, 'matching'))).toEqual(['done', 'current', 'available', 'locked'])
    expect(PROJECT_STEPS.map((s) => stepState(saved, s, 'simulation'))).toEqual(['done', 'done', 'current', 'done'])
  })

  it('самый дальний шаг не уменьшается при возврате назад', () => {
    expect(furthestStep('simulation', 'params')).toBe('simulation')
    expect(furthestStep('matching', 'economics')).toBe('economics')
  })

  it('устаревший подбор сжимает дальний шаг: допущения — на параметры, расчёт — на подбор', () => {
    expect(rewindStep('economics', 'params')).toBe('params')
    expect(rewindStep('params', 'matching')).toBe('params')
    const walked = applyInputsPatch(
      { ...emptyInputs('2026-09-26T09:00:00.000Z'), matching: { calcParams: {}, selection: null, manualSolutionIds: [] } },
      { matching: { calcParams: { utilization: 0.7 } } },
      '2026-09-26T10:00:00.000Z',
    )
    expect(matchingStaleCause({ matching: { calcParams: { utilization: 0.7 } } }, walked)).toBe('calcParams')
    expect(stepAfterMatchingStale('simulation', 'calcParams')).toBe('matching')
    expect(stepAfterMatchingStale('simulation', 'params')).toBe('params')
    expect(stepAfterMatchingStale('params', 'calcParams')).toBe('params')
  })
})
