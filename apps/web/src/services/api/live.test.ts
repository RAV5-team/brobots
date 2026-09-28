import { describe, expect, it } from 'vitest'
import { createHttpClient } from '@/api/http'
import { createMockServices } from '../mock'
import { createApiServices } from '.'

/**
 * Сервисы фронта на живом services/api (docs/api/README.md: seed и AUTH_DEV_MODE=true):
 *   API_SMOKE_URL=http://localhost:8000 npx vitest run src/services/api/live.test.ts
 * Без адреса тест пропускается.
 */
const API_URL = process.env.API_SMOKE_URL
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
})
