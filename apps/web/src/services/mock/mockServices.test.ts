import { describe, expect, it } from 'vitest'
import { NEW_LOCATION_SAMPLE } from '@/mocks/fixtures/newLocation'
import { ConflictError, InvalidCredentialsError, NotFoundError } from '../errors'
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

  it('summarises every location for the list cards (PRD 10.1)', async () => {
    const summaries = await services.locations.listLocationSummaries()
    const pick = (id: string) => summaries.find((s) => s.locationId === id)
    // РЦ Химки: 20 000 м², 180 чел, 2 × 11 ч, 5 процессов, 231 млн ₽; допущений 2 — как в форме (PRD 15 · №45).
    expect(pick('LOC-01')).toMatchObject({
      totalAreaM2: 20000, staffTotal: 180, shiftsPerDay: 2, shiftHours: 11, processesCount: 5,
      laborCostRubYear: 231_000_000, workersInProcesses: 145, assumptionsCount: 2, projectsCount: 2, projectsCompleted: 0,
    })
    // Аэропорт: персонал — сумма групп 320 + 180, смены — из PRD 10.1 (в датасете режима нет).
    expect(pick('LOC-03')).toMatchObject({ staffTotal: 500, shiftsPerDay: 3, shiftHours: 8, processesCount: 3 })
    // Медучреждение: 65 + 28 + 18 = 111 чел, 3 смены по 24 / 3 = 8 ч.
    expect(pick('LOC-04')).toMatchObject({ staffTotal: 111, shiftsPerDay: 3, shiftHours: 8, processesCount: 4 })
  })

  it('rejects an unknown location', async () => {
    await expect(services.locations.getLocation('LOC-99')).rejects.toThrow('Локация LOC-99 не найдена')
  })

  it('creates a location with an empty process list (PRD 10.1, экран 12а; PRD 15 · №43)', async () => {
    const own = createMockServices({ latencyMs: 0 })
    const created = await own.locations.createLocation(NEW_LOCATION_SAMPLE)
    const summary = (await own.locations.listLocationSummaries()).find((s) => s.locationId === created.id)

    expect(created.id).toBe('LOC-05')
    expect(Date.now() - Date.parse(created.updatedAt)).toBeLessThan(1000)
    await expect(own.locations.getLocation(created.id)).resolves.toMatchObject({ name: 'РЦ Подольск' })
    expect(summary).toMatchObject({
      totalAreaM2: 20000, staffTotal: 180, processesCount: 0, laborCostRubYear: null, workersInProcesses: null,
      projectsCount: 0, projectsCompleted: 0,
    })
    // Полнота — доля заполненных параметров типа объекта: у Химки 40 из 42.
    expect(summary?.parametersCompletenessPct).toBe(95)
    // Фикстуры и другие экземпляры сервиса не меняются.
    expect(await services.locations.listLocations()).toHaveLength(4)
  })
})

describe('mock updateLocation (вкладка 17а, PRD 10.3)', () => {
  it('replaces the profile, keeps the id and moves updatedAt', async () => {
    const own = createMockServices({ latencyMs: 0 })
    const current = await own.locations.getLocation('LOC-01')

    const saved = await own.locations.updateLocation('LOC-01', { ...current, name: 'РЦ Химки-2' })

    expect(saved).toMatchObject({ id: 'LOC-01', name: 'РЦ Химки-2' })
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(Date.parse(current.updatedAt))
    await expect(own.locations.getLocation('LOC-01')).resolves.toMatchObject({ name: 'РЦ Химки-2' })
    expect(await own.locations.listLocations()).toHaveLength(4)
    // Фикстуры и другие экземпляры сервиса не меняются.
    await expect(services.locations.getLocation('LOC-01')).resolves.toMatchObject({ name: 'РЦ Химки' })
  })

  it('rejects an unknown location', async () => {
    await expect(services.locations.updateLocation('LOC-99', NEW_LOCATION_SAMPLE)).rejects.toBeInstanceOf(NotFoundError)
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

describe('mock addLocationProcess (окно 15а, PRD 10.4)', () => {
  it('binds a template copy with template values and counts it in the summary', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const added = await local.locations.addLocationProcess('LOC-01', 'PR-0006')
    expect(added).toEqual({ id: 'LP-16', locationId: 'LOC-01', processCode: 'PR-0006', name: null, overrides: {}, workers: [] })
    expect((await local.locations.listLocationProcesses('LOC-01')).map((lp) => lp.id)).toContain('LP-16')
    const summary = (await local.locations.listLocationSummaries()).find((s) => s.locationId === 'LOC-01')
    expect(summary?.processesCount).toBe(6)
  })

  it('adds a template to a location only once', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await expect(local.locations.addLocationProcess('LOC-01', 'PR-0001')).rejects.toBeInstanceOf(ConflictError)
  })

  it('rejects unknown locations and templates', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await expect(local.locations.addLocationProcess('LOC-99', 'PR-0006')).rejects.toBeInstanceOf(NotFoundError)
    await expect(local.locations.addLocationProcess('LOC-01', 'PR-9999')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('mock removeLocationProcess (окно 17в, PRD 10.4)', () => {
  it('removes only this copy: the template and other locations keep their processes', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const others = await local.locations.listLocationProcesses('LOC-02')
    await local.locations.removeLocationProcess('LP-01')
    expect((await local.locations.listLocationProcesses('LOC-01')).map((lp) => lp.id)).not.toContain('LP-01')
    expect(await local.locations.listLocationProcesses('LOC-02')).toEqual(others)
    expect((await local.processes.listProcesses()).some((p) => p.code === 'PR-0001')).toBe(true)
    const summary = (await local.locations.listLocationSummaries()).find((s) => s.locationId === 'LOC-01')
    expect(summary?.processesCount).toBe(4)
  })

  it('lets the template come back as a new copy with a fresh id', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await local.locations.removeLocationProcess('LP-01')
    const added = await local.locations.addLocationProcess('LOC-01', 'PR-0001')
    expect(added.id).toBe('LP-16')
  })

  it('rejects an unknown process', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await expect(local.locations.removeLocationProcess('LP-99')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('mock updateLocationProcess (форма 16, PRD 10.4)', () => {
  const update = {
    name: 'Перемещение паллет · кросс-докинг',
    overrides: { dailyVolume: 2400 },
    templateOverrides: { speedLimitMps: 1.2 },
    handling: [{ method: 'forks', laborReplacementRatio: 0.75 }],
    workers: [{ role: 'Операторы погрузчиков', timeShare: 0.8 }],
  } as const

  it('stores the values of the copy on the location', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const saved = await local.locations.updateLocationProcess('LP-01', update)
    expect(saved).toMatchObject({ id: 'LP-01', locationId: 'LOC-01', processCode: 'PR-0001', ...update })
    const [first] = await local.locations.listLocationProcesses('LOC-01')
    expect(first).toEqual(saved)
  })

  it('does not change the template or other locations (копия шаблона, D-11)', async () => {
    const local = createMockServices({ latencyMs: 0 })
    const templateBefore = await local.processes.getProcess('PR-0001')
    const otherBefore = await local.locations.listLocationProcesses('LOC-02')
    await local.locations.updateLocationProcess('LP-01', update)
    expect(await local.processes.getProcess('PR-0001')).toEqual(templateBefore)
    expect(await local.locations.listLocationProcesses('LOC-02')).toEqual(otherBefore)
  })

  it('rejects unknown location processes', async () => {
    const local = createMockServices({ latencyMs: 0 })
    await expect(local.locations.updateLocationProcess('LP-99', update)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('mock location documents (вкладка 17б, PRD 10.3)', () => {
  it('lists the four survey documents of РЦ Химки and none for other locations', async () => {
    const { locations } = createMockServices({ latencyMs: 0 })
    const documents = await locations.listLocationDocuments('LOC-01')
    expect(documents.map((d) => d.name)).toEqual([
      'План склада, этаж 1.dwg', 'Фото зоны приёмки.jpg', 'Обследование объекта.xlsx', 'Схема зон и маршрутов.pdf',
    ])
    expect(await locations.listLocationDocuments('LOC-02')).toEqual([])
  })

  it('adds a photo group as one document with the kind taken from the extension', async () => {
    const { locations } = createMockServices({ latencyMs: 0 })
    const added = await locations.addLocationDocument('LOC-02', [new File(['a'], 'Стеллажи.JPG'), new File(['b'], '2.jpg')])
    expect(added).toMatchObject({ id: 'DOC-05', locationId: 'LOC-02', name: 'Стеллажи.JPG', extension: 'jpg', kind: 'photo', fileCount: 2 })
    expect(await locations.listLocationDocuments('LOC-02')).toEqual([added])
  })

  it('recognises CAD plans, tables and plain PDF', async () => {
    const { locations } = createMockServices({ latencyMs: 0 })
    const kinds = await Promise.all(['План.dwg', 'Табель.xls', 'Замеры.csv', 'Отчёт.pdf'].map(async (name) =>
      (await locations.addLocationDocument('LOC-01', [new File(['x'], name)])).kind))
    expect(kinds).toEqual(['cad', 'excel', 'csv', 'pdf'])
  })

  it('rejects an unknown location', async () => {
    const { locations } = createMockServices({ latencyMs: 0 })
    await expect(locations.addLocationDocument('LOC-99', [new File(['x'], 'a.pdf')])).rejects.toBeInstanceOf(NotFoundError)
  })
})
