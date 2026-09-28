import { describe, expect, it } from 'vitest'
import { emptyInputs } from '@/domain'
import type { ApiSchemas } from '../contract'
import { ContractError } from '../contract'
import { toProject } from './project'

const AT = '2026-09-26T09:00:00Z'
const RESULT = { capexRub: 6_100_000, opexRubPerYear: 42_000_000, paybackYears: 0.7, annualEffectRub: 9_200_000 }

/** Копия без полей — ответ, где их не прислали. */
const without = <T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as K))) as Omit<T, K>

const dto: ApiSchemas['Project'] = {
  id: 'PJ-01',
  name: 'Роботизация паллетного потока · РЦ Химки',
  locationId: 'LOC-01',
  status: 'saved',
  task: { id: 'LP-01', name: 'Перемещение паллет' },
  savedAt: AT,
  updatedAt: AT,
  snapshotTakenAt: '2026-09-15T00:00:00Z',
  versions: { catalog: 4, model: '2.1', norms: 3, dictionaries: 1 },
}

describe('toProject', () => {
  it('сохранённая оценка: процесс из task, версии, снимок результата', () => {
    const project = toProject(dto, { step: 'economics', inputs: emptyInputs(AT), result: RESULT })
    expect(project).toMatchObject({
      id: 'PJ-01',
      status: 'saved',
      locationProcessId: 'LP-01',
      versions: { snapshotAt: '2026-09-15', catalog: 4, model: '2.1', norms: 3 },
      result: RESULT,
    })
  })

  it('черновик: шаг из состояния проекта, процесс может быть не выбран, решение из каталога', () => {
    const draft = toProject({ ...without(dto, 'task', 'savedAt'), status: 'draft', pinnedSolutionId: 'RB-0008' }, { step: 'matching', inputs: emptyInputs(AT), result: null })
    expect(draft).toMatchObject({ status: 'draft', step: 'matching', locationProcessId: null, pinnedSolutionId: 'RB-0008' })
  })

  it('нет обязательного поля — понятная ошибка контракта', () => {
    expect(() => toProject(without(dto, 'locationId'), { step: 'params', inputs: emptyInputs(AT), result: RESULT }))
      .toThrow(new ContractError('Project: в ответе API нет обязательного поля «locationId»'))
  })

  it('у сохранённой оценки обязательны процесс и снимок результата', () => {
    expect(() => toProject(without(dto, 'task'), { step: 'economics', inputs: emptyInputs(AT), result: RESULT })).toThrow(/«task»/)
    expect(() => toProject(dto, { step: 'economics', inputs: emptyInputs(AT), result: null })).toThrow(/снимка результата/)
  })

  it('статус вне перечня — ошибка контракта', () => {
    expect(() => toProject({ ...dto, status: 'archived' as 'saved' }, { step: 'params', inputs: emptyInputs(AT), result: RESULT }))
      .toThrow(/«archived» не входит в перечень draft \| saved/)
  })
})
