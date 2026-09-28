import { describe, expect, it } from 'vitest'
import { createHttpClient } from '@/api/http'
import { createMockServices } from '../mock'
import { createApiServices } from '.'

/**
 * Сервисы фронта на живом services/api (docs/api/README.md: seed и AUTH_DEV_MODE=true):
 *   API_SMOKE_URL=http://localhost:8000 npx vitest run src/services/api/live.test.ts
 * Без адреса тест пропускается.
 */
const ENV = (globalThis as { readonly process?: { readonly env: Readonly<Record<string, string | undefined>> } }).process?.env
const API_URL = ENV?.API_SMOKE_URL
/** API_SMOKE_SIMULATION=1 — у api задан SIMULATION_URL: прогон идёт до вердикта (до 90 с). */
const SIMULATION = ENV?.API_SMOKE_SIMULATION === '1'
const http = createHttpClient({ baseUrl: `${API_URL ?? ''}/api/v1` })
const services = createApiServices(createMockServices({ latencyMs: 0 }), http)

describe.skipIf(!API_URL)('services on the live API', () => {
  it('catalog', async () => {
    const robots = await services.catalog.listRobots()
    expect(robots.length).toBeGreaterThan(10)
    const withClass = robots.find((r) => r.operationClasses.length > 0)
    expect(withClass).toBeDefined()
    const robot = await services.catalog.getRobot(withClass?.id ?? '')
    expect(robot.name).toBe(withClass?.name)
    const items = await services.catalog.listLaunchItems()
    expect(items.some((i) => i.launchCategory === 'charging')).toBe(true)
    const classes = await services.catalog.listOperationClasses()
    expect(classes.map((c) => c.code)).toContain('OP-01')
    expect((await services.catalog.countRobotsByClass())['OP-01']).toBeGreaterThan(0)
    expect((await services.catalog.listHandlingMethods()).map((m) => m.code)).toContain('forks')
    expect((await services.catalog.listRobots({ operationClass: 'OP-01' })).length).toBeGreaterThan(0)
  })

  it('processes and locations', async () => {
    const processes = await services.processes.listProcesses()
    expect(processes.length).toBeGreaterThanOrEqual(12)
    expect((await services.processes.getProcess('PR-0001')).operationClass).toBe('OP-01')

    const locations = await services.locations.listLocations()
    const location = locations.find((l) => l.facilityType === 'warehouse')
    expect(location).toBeDefined()
    const full = await services.locations.getLocation(location?.id ?? '')
    expect(Object.keys(full.parameters).length).toBeGreaterThan(5)
    const lps = await services.locations.listLocationProcesses(full.id)
    expect(lps.length).toBeGreaterThan(0)
    expect(lps.every((lp) => lp.processCode.startsWith('PR-'))).toBe(true)
    const summaries = await services.locations.listLocationSummaries()
    expect(summaries.find((s) => s.locationId === full.id)?.processesCount).toBe(lps.length)
    expect((await services.locations.listFacilityTypes()).map((t) => t.code)).toEqual(expect.arrayContaining(['warehouse', 'airport', 'medical']))
    expect((await services.locations.listFacilityParameters('warehouse')).length).toBeGreaterThan(20)
  })

  it('admin, dashboard and data version', async () => {
    const norms = await services.admin.listNorms()
    const reserve = norms.find((n) => n.code === 'fleet_reserve_share')
    expect(reserve).toMatchObject({ unit: '%', value: 15 })
    const saved = await services.admin.saveNorms([{ code: 'fleet_reserve_share', value: 20 }])
    expect(saved.find((n) => n.code === 'fleet_reserve_share')?.value).toBeCloseTo(20)
    await services.admin.saveNorms([{ code: 'fleet_reserve_share', value: 15 }])

    const sources = await services.admin.listDataSources()
    expect(sources.length).toBeGreaterThan(3)
    const refreshed = await services.admin.refreshDataSource(sources[0]?.key ?? '')
    expect(refreshed.actualizedOn.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))

    expect((await services.dashboard.getInputs()).laborCosts.length).toBeGreaterThan(0)
    expect((await services.session.getDataVersion()).catalog).toMatch(/^v\d+/)
  })

  it('project: draft → matching → selection → economics → save', async () => {
    const location = (await services.locations.listLocations()).find((l) => l.facilityType === 'warehouse')
    const draft = await services.projects.createDraft({ name: 'Смоук · проект', locationId: location?.id ?? '' })
    expect(draft).toMatchObject({ status: 'draft', step: 'params' })
    expect(draft.locationProcessId).not.toBeNull()

    const snapshot = await services.projects.getParamsSnapshot(draft.id)
    expect(snapshot.processes.length).toBeGreaterThan(0)
    const palletProcess = snapshot.processes.find((p) => p.process.code === 'PR-0001')
    if (palletProcess) await services.projects.selectProcess(draft.id, palletProcess.locationProcess.id)

    await services.projects.updateInputs(draft.id, { params: { assumptions: [{ code: 'wh_total_area', value: 12_000, kind: 'fact' }] } })
    expect((await services.projects.getProject(draft.id)).inputs.params.assumptions).toHaveLength(1)
    await services.projects.updateInputs(draft.id, { matching: { calcParams: {} } })
    expect((await services.projects.openStep(draft.id, 'params')).status).toBe('draft')

    const matching = await services.projects.evaluateMatching(draft.id)
    expect(matching.stale).toBe(false)
    const variant = matching.variants.find((v) => v.acquisition === 'purchase' && v.paybackYears !== null) ?? matching.variants[0]
    expect(variant).toBeDefined()
    expect(matching.calcDefaults?.horizonYears).toBeGreaterThanOrEqual(5)
    await services.projects.updateInputs(draft.id, { matching: { selection: { solutionId: variant?.solutionId ?? '', acquisition: variant?.acquisition ?? 'purchase' } } })

    const economics = await services.projects.getEconomics(draft.id)
    expect(economics.solutionId).toBe(variant?.solutionId)
    expect(economics.scenarios.length).toBeGreaterThan(0)

    if (SIMULATION) {
      let job = await services.projects.startSimulation(draft.id, { fleet: { robots: variant?.robots ?? 1, stations: variant?.stations ?? 1 }, conditions: { maxWaitMin: 20 } })
      for (let i = 0; i < 90 && (job.status === 'queued' || job.status === 'running'); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        job = await services.projects.getSimulationJob(job.id)
      }
      expect(job).toMatchObject({ status: 'done', error: null })
      const run = await services.projects.getSimulationRun(job.runId ?? '')
      expect(run.title).toBeTruthy()
      expect((await services.projects.getSimulationTraces(job.runId ?? '')).length).toBeGreaterThan(0)
    }

    await services.projects.updateInputs(draft.id, { economics: { scenario: variant?.acquisition ?? 'purchase' } })
    const saved = await services.projects.save(draft.id)
    expect(saved.status).toBe('saved')
    expect(saved.result.capexRub).toBe(economics.scenarios.find((s) => s.acquisition === variant?.acquisition)?.capexRub)
    const quoted = await services.projects.requestQuote(draft.id)
    expect(quoted.inputs.economics?.quoteRequestedAt).toBeTruthy()
    expect((await services.projects.listProjects()).some((p) => p.id === draft.id && p.status === 'saved')).toBe(true)
  }, 120_000)
})
