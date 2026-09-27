import { describe, expect, it } from 'vitest'
import { isCatalogRefreshDone, type CatalogRefresh, type NewDataSource, type NewRobot } from '@/domain'
import { InvalidCredentialsError, NotFoundError, ValidationError } from '../errors'
import { createMockServices } from './index'
import { createMockSession } from './session'

const services = createMockServices({ latencyMs: 0 })

const NEW_SOURCE: NewDataSource = {
  name: 'Данные поставщика «Морос», ТТХ AMR 800',
  kind: 'specs',
  origin: 'open',
  locator: { kind: 'file', fileName: 'moros_amr800_spec.pdf' },
  status: 'estimate',
  provides: 'ТТХ решений',
  actualizedOn: '2026-09-19',
  refresh: 'manual',
}

const NEW_ROBOT: NewRobot = {
  name: 'AMR 900',
  manufacturer: 'ООО «Морос»',
  type: 'Мобильные роботы',
  subtype: 'AMR',
  readiness: 'pilot',
  trl: 7,
  priceRub: 2_100_000,
  operationClasses: [{ code: 'OP-10' }],
  specs: { confidence: 'partial', payloadKg: 900 },
  photos: ['amr900_front.jpg'],
}

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

  it('creates an operation class with the next free code and zero robots (PRD 6.7, А10)', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const created = await local.catalog.createOperationClass({
      name: 'Буксировка прицепов',
      description: 'Перемещение прицепов и тележек между зонами тягачом',
      unit: 'ед. / ч',
      typicalCarriers: ['прицеп', 'тележка'],
      exampleProcesses: ['Буксировка багажных тележек'],
    })
    expect(created.code).toBe('OP-11')
    const classes = await local.catalog.listOperationClasses()
    expect(classes.map((c) => c.code)).toContain('OP-11')
    expect((await local.catalog.countRobotsByClass())['OP-11']).toBe(0)
    expect(await services.catalog.listOperationClasses()).toHaveLength(10)
  })

  it('creates a robot with the next free id, shown first-class in the catalog (PRD 6.3, А2 → А3)', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const created = await local.catalog.createRobot(NEW_ROBOT)
    expect(created).toMatchObject({ id: 'RB-0225', name: 'AMR 900', needsConfirmation: false, photos: ['amr900_front.jpg'] })
    await expect(local.catalog.getRobot('RB-0225')).resolves.toMatchObject({ name: 'AMR 900' })
    expect(await local.catalog.listRobots()).toHaveLength(21)
    expect((await local.catalog.countRobotsByClass())['OP-10']).toBe(1)
    expect(await services.catalog.listRobots()).toHaveLength(20)
  })

  it('rejects a robot that is already in the catalog: same name and manufacturer (PRD 6.1)', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await expect(local.catalog.createRobot({ ...NEW_ROBOT, name: ' amr 800 ', manufacturer: 'ООО «Морос»' }))
      .rejects.toBeInstanceOf(ValidationError)
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
    expect(await services.admin.listDataSources()).toHaveLength(7)
  })

  it('switches auto-refresh of a linked source and keeps it for the next read (PATCH /data-sources, А6)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    await expect(admin.updateDataSource('vendor_sites', { refresh: 'manual' })).resolves.toMatchObject({ refresh: 'manual' })
    const after = await admin.listDataSources()
    expect(after.find((s) => s.key === 'vendor_sites')?.refresh).toBe('manual')
  })

  it('refuses auto-refresh for a file source: a file is updated by uploading a new one (PRD 6.10)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    await expect(admin.updateDataSource('catalog_v4', { refresh: 'monthly' })).rejects.toThrow('Автообновление доступно только для источника по ссылке')
    await expect(admin.updateDataSource('nope', { refresh: 'manual' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refreshes a source on request and moves its actualization date (А6 «Обновить»)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    const before = Date.now()
    const refreshed = await admin.refreshDataSource('datasets')
    expect(Date.parse(refreshed.actualizedOn)).toBeGreaterThanOrEqual(before)
    await expect(admin.refreshDataSource('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('adds a new file source to the registry (POST /data-sources, А7)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    const created = await admin.createDataSource(NEW_SOURCE)
    expect(created).toMatchObject({ name: NEW_SOURCE.name, kind: 'specs', status: 'estimate', refresh: 'manual', locator: NEW_SOURCE.locator })
    expect(created.actualizedOn).toBe('2026-09-19T00:00:00Z')
    const after = await admin.listDataSources()
    expect(after).toHaveLength(8)
    expect(after.at(-1)?.key).toBe(created.key)
    expect(after.filter((s) => s.key === created.key)).toHaveLength(1)
  })

  it('refuses auto-refresh for a new file source and a duplicate name (PRD 6.10)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    await expect(admin.createDataSource({ ...NEW_SOURCE, refresh: 'monthly' })).rejects.toBeInstanceOf(ValidationError)
    await expect(admin.createDataSource({ ...NEW_SOURCE, name: 'Демо-датасеты объектов' })).rejects.toBeInstanceOf(ValidationError)
    expect(await admin.listDataSources()).toHaveLength(7)
  })

  it('checks a source link: reachable with a change date, .invalid hosts unreachable (А7б, D-42)', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    expect(await admin.checkDataSourceUrl('https://moros.ru/catalog/amr-800')).toMatchObject({ reachable: true })
    expect(await admin.checkDataSourceUrl('https://moros.invalid/amr-800')).toEqual({ reachable: false })
  })

  it('creates a link source with a weekly auto-refresh', async () => {
    const admin = createMockServices({ latencyMs: 0 }).admin
    const created = await admin.createDataSource({ ...NEW_SOURCE, locator: { kind: 'url', url: 'https://moros.ru/catalog/amr-800' }, refresh: 'weekly' })
    expect(created.refresh).toBe('weekly')
  })

  it('replays the recorded catalog refresh frame by frame and restarts it (А1а, ТЗ 4.2.7)', async () => {
    const statuses = (r: CatalogRefresh) => r.sources.map((s) => s.status)
    expect(statuses(await services.admin.startCatalogRefresh())).toEqual(['waiting', 'queued', 'queued'])
    expect(statuses(await services.admin.getCatalogRefresh())).toEqual(['received', 'waiting', 'queued'])
    await services.admin.getCatalogRefresh()
    const last = await services.admin.getCatalogRefresh()
    expect(isCatalogRefreshDone(last)).toBe(true)
    expect(await services.admin.getCatalogRefresh()).toEqual(last)
    expect(statuses(await services.admin.startCatalogRefresh())).toEqual(['waiting', 'queued', 'queued'])
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
