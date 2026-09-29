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
    expect(edited.step).toBe('params')
    expect((await projects.getProject('PJ-DEMO')).inputs.stale.matching).toBe(true)
    await expect(projects.updateInputs('PJ-01', { economics: { scenario: 'purchase' } })).rejects.toBeInstanceOf(ConflictError)
  })

  it('открытие шага: CTA двигает на следующий, через один и назад без сдвига', async () => {
    const projects = service()
    await expect(projects.openStep('PJ-02', 'simulation')).rejects.toBeInstanceOf(ConflictError)
    expect(await projects.openStep('PJ-02', 'matching')).toMatchObject({ step: 'matching' })
    const back = await projects.openStep('PJ-04', 'params')
    expect(back).toMatchObject({ step: 'matching' })
  })

  it('новый черновик проходит шаги кнопкой openStep до итога', async () => {
    const projects = service()
    const draft = await projects.createDraft({ name: 'x', locationId: 'LOC-01', locationProcessId: 'LP-01' })
    expect(draft.step).toBe('params')
    await expect(projects.openStep(draft.id, 'economics')).rejects.toBeInstanceOf(ConflictError)
    expect(await projects.openStep(draft.id, 'matching')).toMatchObject({ step: 'matching' })
    expect(await projects.openStep(draft.id, 'simulation')).toMatchObject({ step: 'simulation' })
    expect(await projects.openStep(draft.id, 'economics')).toMatchObject({ step: 'economics' })
  })

  it('«Параметры расчёта» сжимают дальний шаг до подбора', async () => {
    const projects = service()
    const edited = await projects.updateInputs('PJ-DEMO', { matching: { calcParams: { workHoursPerDay: 20 } } })
    expect(edited.step).toBe('matching')
    expect(edited.inputs.stale.matching).toBe(true)
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

  it('пересчёт подбора снимает «устарело», выбор сохраняется; исходные параметры и база — в ответе', async () => {
    const projects = service()
    await projects.updateInputs('PJ-DEMO', { matching: { calcParams: { utilization: 0.7 } } })
    const fresh = await projects.evaluateMatching('PJ-DEMO')
    expect(fresh.stale).toBe(false)
    expect(fresh.calcDefaults).toMatchObject({ workHoursPerDay: 22, utilization: 0.75, horizonYears: 5 })
    expect(fresh.baseline).toEqual({ opexRubPerYear: 51_200_000, tcoRub: 256_000_000 })
    const project = await projects.getProject('PJ-DEMO')
    expect(project.inputs.stale.matching).toBe(false)
    expect(project.inputs.matching?.selection).toEqual({ solutionId: 'RB-0008', acquisition: 'raas' })
    await expect(projects.evaluateMatching('PJ-01')).rejects.toBeInstanceOf(ConflictError)
  })

  it('прогон: состав 15/6 из запроса даёт «нужно докупить»; журнал растёт на строку за опрос, проект задание не меняет', async () => {
    const projects = service()
    const job = await projects.startSimulation('PJ-DEMO', { fleet: { robots: 15, stations: 6 }, conditions: {} })
    expect(job).toMatchObject({ status: 'queued', log: [], elapsedS: 0 })
    const first = await projects.getSimulationJob(job.id)
    expect(first).toMatchObject({ status: 'running', elapsedS: 1, runId: null })
    expect(first.log).toHaveLength(1)
    const done = await finish(projects, job.id)
    expect(done.log.length).toBeGreaterThan(2)
    expect(done.log[1]).toContain('роботов 15, станций 6')
    const run = await projects.getSimulationRun(done.runId ?? '')
    expect(run).toMatchObject({ verdict: 'need_more', from: { robots: 15, stations: 6 }, to: { robots: 18, stations: 6 } })
    // Прогон в черновик записывает SimulationRunService — у гостя он не сохраняется (D-14).
    expect((await projects.getProject('PJ-DEMO')).inputs.simulation?.runId).toBe('SIM-0926-01')
  })

  it('прогон сохранённой оценки не запускается (D-17)', async () => {
    await expect(service().startSimulation('PJ-01', { fleet: { robots: 18, stations: 6 }, conditions: {} })).rejects.toBeInstanceOf(ConflictError)
  })

  it('2D-трассы: прогон с изменённым составом — две (из подбора и итоговая), без изменений — одна; срез — по запросу', async () => {
    // Маленькие трассы вместо файлов по 1,7 МБ: формат настоящих файлов проверяет traces.test.ts.
    const tiny = (robots: number) => ({
      name: `${String(robots)} роботов`, step_s: 15, n_robots: robots, n_chargers: 1, states: ['idle'],
      layout: { nodes: [], edges: [], charger_slots: [], width: 1, depth: 1 },
      frames: [{ t: 0, r: Array.from({ length: robots }, () => [0, 0, 0]) }],
    })
    const loaded: string[] = []
    const projects = createMockProjects({ latencyMs: 0 }, (file, resolution) => {
      loaded.push(`${file}:${resolution}`)
      return Promise.resolve(tiny(file === 'demo-18-6' ? 18 : 16))
    })
    const [before, after] = await projects.getSimulationTraces('SIM-0926-02')
    expect([before?.robots, after?.robots]).toEqual([18, 16])
    expect(await projects.getSimulationTraces('SIM-0926-01')).toHaveLength(1)
    expect(await projects.getSimulationTraces('SIM-0926-03')).toEqual([])
    expect(await projects.getSimulationTraces('SIM-0926-02', 'hourly')).toHaveLength(2)
    expect(loaded).toEqual(['demo-18-6:full', 'demo-16-5:full', 'demo-18-6:full', 'demo-18-6:hourly', 'demo-16-5:hourly'])
    await expect(projects.getSimulationTraces('SIM-X')).rejects.toBeInstanceOf(NotFoundError)
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

  it('сохранённый демо-проект уходит в список A1 с теми же числами, что на итоге (D-81)', async () => {
    const projects = service()
    const economics = await projects.getEconomics('PJ-DEMO')
    const raas = economics.scenarios.find((s) => s.acquisition === 'raas')
    await projects.save('PJ-DEMO')
    const listed = (await projects.listProjects()).find((p) => p.id === 'PJ-DEMO')
    expect(listed).toMatchObject({ status: 'saved', result: { capexRub: raas?.capexRub, opexRubPerYear: raas?.opexRubPerYear, paybackYears: raas?.paybackYears, annualEffectRub: raas?.annualEffectRub } })
  })

  it('снимки сохранённых оценок PJ-01 и PJ-06 совпадают с числами итога выбранного сценария', async () => {
    const projects = service()
    for (const id of ['PJ-01', 'PJ-06'] as const) {
      const project = await projects.getProject(id)
      const economics = await projects.getEconomics(id)
      const chosen = economics.scenarios.find((s) => s.acquisition === project.inputs.economics?.scenario)
      if (project.status !== 'saved' || !chosen) throw new Error(`${id}: нет снимка или сценария`)
      expect(project.result).toEqual({ capexRub: chosen.capexRub, opexRubPerYear: chosen.opexRubPerYear, paybackYears: chosen.paybackYears, annualEffectRub: chosen.annualEffectRub })
    }
  })

  it('запрос КП: отметка времени и у черновика, и у сохранённой оценки; без выбора — отказ (D-106)', async () => {
    const projects = service()
    const draft = (await projects.requestQuote('PJ-DEMO')).inputs.economics
    expect(draft?.scenario).toBe('raas')
    expect(typeof draft?.quoteRequestedAt).toBe('string')
    expect(typeof (await projects.requestQuote('PJ-01')).inputs.economics?.quoteRequestedAt).toBe('string')
    await expect(projects.requestQuote('PJ-02')).rejects.toBeInstanceOf(ConflictError)
  })
  it('снимок шага 1: профиль локации, пять процессов РЦ Химки, параметры площадки из справочника, решение из каталога (PRD 11.2)', async () => {
    const snapshot = await service().getParamsSnapshot('PJ-DEMO')
    expect(snapshot.location.id).toBe('LOC-01')
    expect(snapshot.processes.map((p) => p.locationProcess.id)).toEqual(['LP-01', 'LP-02', 'LP-03', 'LP-04', 'LP-05'])
    expect(snapshot.siteParameters).toHaveLength(26)
    expect(snapshot.pinnedSolution).toEqual({ id: 'RB-0008', name: 'AMR 800' })
    expect((await service().getParamsSnapshot('PJ-07')).pinnedSolution).toBeNull()
  })

  it('смена процесса: решения следующих шагов сбрасываются, черновик — на «Параметрах» (D-94); сохранённая оценка — отказ', async () => {
    const projects = service()
    const project = await projects.selectProcess('PJ-DEMO', 'LP-03')
    expect(project).toMatchObject({ status: 'draft', step: 'params', locationProcessId: 'LP-03' })
    expect(project.inputs).toMatchObject({ matching: null, simulation: null, economics: null, params: { assumptions: [] } })
    await expect(projects.selectProcess('PJ-DEMO', 'LP-09')).rejects.toBeInstanceOf(NotFoundError)
    await expect(projects.selectProcess('PJ-01', 'LP-02')).rejects.toBeInstanceOf(ConflictError)
  })
})
