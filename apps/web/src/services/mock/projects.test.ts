import { describe, expect, it } from 'vitest'
import { ConflictError, NotFoundError } from '../errors'
import { createMockProjects } from './projects'

const service = () => createMockProjects({ latencyMs: 0 })

/** Пройти задание до конца: мок продвигает журнал на строку за опрос. */
async function finish(projects: ReturnType<typeof service>, jobId: string) {
  for (let i = 0; i < 20; i += 1) {
    const job = await projects.getSimulationJob(jobId)
    if (job.status === 'done') return job
  }
  throw new Error('прогон не завершился')
}

describe('мок проектов', () => {
  it('список — 7 проектов PRD 11.1 без демо-проекта, сначала недавние', async () => {
    const list = await service().listProjects()
    expect(list.map((p) => p.id)).toEqual(['PJ-01', 'PJ-02', 'PJ-03', 'PJ-04', 'PJ-05', 'PJ-06', 'PJ-07'])
  })

  it('черновик из окна A2: процесс и решение из каталога, пустые решения по шагам', async () => {
    const draft = await service().createDraft({ name: 'x', locationId: 'LOC-01', locationProcessId: 'LP-01', solutionId: 'RB-0008' })
    expect(draft).toMatchObject({ status: 'draft', step: 'params', locationProcessId: 'LP-01', pinnedSolutionId: 'RB-0008' })
    expect(draft.inputs.matching).toBeNull()
  })

  it('правка решений — автосохранение с правилом D-89; сохранённая оценка — только просмотр', async () => {
    const projects = service()
    const edited = await projects.updateInputs('PJ-DEMO', { params: { assumptions: [{ code: 'route_length_m', value: 86, kind: 'fact' }] } })
    expect(edited.inputs.stale).toEqual({ matching: true, simulation: true })
    expect((await projects.getProject('PJ-DEMO')).inputs.stale.matching).toBe(true)
    await expect(projects.updateInputs('PJ-01', { economics: { scenario: 'purchase' } })).rejects.toBeInstanceOf(ConflictError)
  })

  it('открытие шага: черновик запоминает самый дальний, закрытый шаг — отказ', async () => {
    const projects = service()
    await expect(projects.openStep('PJ-02', 'simulation')).rejects.toBeInstanceOf(ConflictError)
    const back = await projects.openStep('PJ-04', 'params')
    expect(back).toMatchObject({ step: 'matching' })
  })

  it('подбор есть у РЦ Химки · паллеты, отметка «устарело» — из решений проекта', async () => {
    const projects = service()
    const matching = await projects.getMatching('PJ-DEMO')
    expect(matching.variants).toHaveLength(8)
    expect(matching.stale).toBe(false)
    await projects.updateInputs('PJ-DEMO', { matching: { calcParams: { workHoursPerDay: 20 } } })
    expect((await projects.getMatching('PJ-DEMO')).stale).toBe(true)
    await expect(projects.getMatching('PJ-04')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('прогон: состав 15/6 даёт «нужно докупить», готовое задание записывает прогон в проект', async () => {
    const projects = service()
    await projects.updateInputs('PJ-DEMO', { simulation: { fleet: { robots: 15, stations: 6 } } })
    const job = await projects.startSimulation('PJ-DEMO')
    expect(job.status).toBe('queued')
    const done = await finish(projects, job.id)
    expect(done.log.length).toBeGreaterThan(2)
    const run = await projects.getSimulationRun(done.runId ?? '')
    expect(run).toMatchObject({ verdict: 'need_more', from: { robots: 15, stations: 6 }, to: { robots: 18, stations: 6 } })
    const project = await projects.getProject('PJ-DEMO')
    expect(project.inputs.simulation?.runId).toBe(run.id)
    expect(project.inputs.stale.simulation).toBe(false)
  })

  it('итог выбранного решения; без выбора — нет итога', async () => {
    const projects = service()
    const economics = await projects.getEconomics('PJ-DEMO')
    expect(economics.scenarios.map((s) => s.acquisition).sort()).toEqual(['purchase', 'raas'])
    await expect(projects.getEconomics('PJ-02')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('сохранение: снимок выбранного сценария (D-81), дальше только просмотр', async () => {
    const projects = service()
    await projects.updateInputs('PJ-DEMO', { economics: { scenario: 'purchase' } })
    const saved = await projects.save('PJ-DEMO')
    expect(saved).toMatchObject({ status: 'saved', result: { capexRub: 47_400_000, opexRubPerYear: 34_500_000, paybackYears: 2.8, annualEffectRub: 16_700_000 } })
    await expect(projects.save('PJ-DEMO')).rejects.toBeInstanceOf(ConflictError)
    await expect(projects.save('PJ-02')).rejects.toBeInstanceOf(ConflictError)
  })
})
