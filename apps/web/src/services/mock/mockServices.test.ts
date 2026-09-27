import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError, NotFoundError } from '../errors'
import { createMockServices } from './index'
import { createMockSession } from './session'

const services = createMockServices({ latencyMs: 0 })

describe('mock catalog service', () => {
  it('lists robots and filters by operation class', async () => {
    const all = await services.catalog.listRobots()
    const op08 = await services.catalog.listRobots({ operationClass: 'OP-08' })
    expect(all).toHaveLength(20)
    expect(op08.length).toBeGreaterThan(0)
    expect(op08.every((r) => r.operationClasses.some((c) => c.code === 'OP-08'))).toBe(true)
  })

  it('derives robot counts per class from the catalog (D-13)', async () => {
    const counts = await services.catalog.countRobotsByClass()
    const robots = await services.catalog.listRobots({ operationClass: 'OP-01' })
    expect(counts['OP-01']).toBe(robots.length)
    expect(counts['OP-10']).toBe(0)
  })

  it('returns a robot by id and rejects unknown ids', async () => {
    await expect(services.catalog.getRobot('RB-0001')).resolves.toMatchObject({ name: 'Ronavi H1500' })
    await expect(services.catalog.getRobot('RB-9999')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('returns copies: mutating a result does not change the store', async () => {
    const [first] = await services.catalog.listRobots()
    if (first) (first as { name: string }).name = 'изменено'
    const again = await services.catalog.listRobots()
    expect(again[0]?.name).not.toBe('изменено')
  })
})

describe('mock location service', () => {
  it('lists processes of a location', async () => {
    const [khimki] = await services.locations.listLocations()
    const processes = await services.locations.listLocationProcesses(khimki?.id ?? 'LOC-00')
    expect(processes).toHaveLength(5)
  })

  it('lists parameter definitions by facility type', async () => {
    expect(await services.locations.listFacilityParameters('airport')).toHaveLength(39)
  })

  it('rejects an unknown location', async () => {
    await expect(services.locations.getLocation('LOC-99')).rejects.toThrow('Локация LOC-99 не найдена')
  })
})

describe('mock process, project and admin services', () => {
  it('lists the process library', async () => {
    expect(await services.processes.listProcesses()).toHaveLength(12)
    await expect(services.processes.getProcess('PR-0003')).resolves.toMatchObject({ name: 'Упаковка' })
  })

  it('lists projects newest first', async () => {
    const projects = await services.projects.listProjects()
    const dates = projects.map((p) => p.updatedAt)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('returns a project by id', async () => {
    await expect(services.projects.getProject('PJ-03')).resolves.toMatchObject({ step: 'simulation' })
    await expect(services.projects.getProject('PJ-99')).rejects.toThrow('Проект PJ-99 не найден')
  })

  it('lists data sources', async () => {
    expect(await services.admin.listDataSources()).toHaveLength(6)
  })
})

describe('mock dashboard service', () => {
  it('returns labor costs for every location and the checks preview', async () => {
    const { laborCosts, checks } = await services.dashboard.getInputs()
    const locations = await services.locations.listLocations()
    expect(laborCosts.map((c) => c.locationId)).toEqual(locations.map((l) => l.id))
    expect(checks.preview.length).toBeLessThanOrEqual(checks.total)
  })
})

describe('mock session service', () => {
  it('returns the persona of the role', async () => {
    await expect(services.session.getProfile('admin')).resolves.toMatchObject({ name: 'А. Соколова', initials: 'АС' })
    await expect(services.session.getProfile('guest')).resolves.toMatchObject({ email: null })
    await expect(services.session.getDataVersion()).resolves.toMatchObject({ source: 'ФЦ БАС', catalog: 'v4', model: '2.1' })
  })

  const session = createMockSession({ latencyMs: 0 }, [{ role: 'admin', email: 'admin@example.test', password: 'secret' }])

  it('signs in a demo account, ignoring case and spaces in the email', async () => {
    await expect(session.signIn({ email: ' Admin@Example.test ', password: 'secret' })).resolves.toMatchObject({ role: 'admin' })
  })

  it('rejects a wrong password', async () => {
    await expect(session.signIn({ email: 'admin@example.test', password: 'Secret' })).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('has no accounts outside the demo build', async () => {
    const closed = createMockSession({ latencyMs: 0 }, [])
    await expect(closed.signIn({ email: 'admin@example.test', password: 'secret' })).rejects.toBeInstanceOf(InvalidCredentialsError)
  })
})

describe('latency', () => {
  it('resolves after the configured delay', async () => {
    const slow = createMockServices({ latencyMs: 30 })
    const started = performance.now()
    await slow.processes.listProcesses()
    expect(performance.now() - started).toBeGreaterThanOrEqual(25)
  })
})
