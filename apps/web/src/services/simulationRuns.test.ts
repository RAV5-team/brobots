import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SimulationJob } from '@/domain'
import { createMockProjects } from './mock/projects'
import { createSimulationRuns, type SimulationRunProgress } from './simulationRuns'

const REQUEST = { fleet: { robots: 15, stations: 6 }, conditions: {} }

const setup = () => {
  const projects = createMockProjects({ latencyMs: 0 })
  const runs = createSimulationRuns(projects)
  const events: (SimulationRunProgress | null)[] = []
  runs.subscribe('PJ-DEMO', (progress) => { events.push(progress) })
  return { projects, runs, events }
}

describe('прогоны симуляции (этап 3, D-103)', () => {
  // Фикстуры прогонов грузятся динамическим импортом: его фальшивые таймеры не дождутся — грузим заранее.
  beforeAll(async () => { await createMockProjects({ latencyMs: 0 }).getSimulationRun('SIM-0926-01') })
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('события прогресса: журнал растёт по строке, в конце — прогон, записанный в черновик', async () => {
    const { projects, runs, events } = setup()
    runs.start('PJ-DEMO', REQUEST, { persist: true })
    expect(runs.get('PJ-DEMO')).toEqual({ status: 'running', log: [], elapsedS: 0 })
    await vi.advanceTimersByTimeAsync(10_000)
    const last = runs.get('PJ-DEMO')
    expect(last).toMatchObject({ status: 'done', runId: 'SIM-0926-03' })
    const lengths = events.flatMap((e) => (e?.status === 'running' ? [e.log.length] : []))
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b))
    expect(Math.max(...lengths)).toBeGreaterThan(1)
    const project = await projects.getProject('PJ-DEMO')
    expect(project.inputs.simulation).toMatchObject({ runId: 'SIM-0926-03', stage: 'verdict' })
    expect(project.inputs.stale.simulation).toBe(false)
  })

  it('гость: прогон готов, но в проект не записывается (D-14)', async () => {
    const { projects, runs } = setup()
    runs.start('PJ-DEMO', REQUEST, { persist: false })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(runs.get('PJ-DEMO')).toMatchObject({ status: 'done', runId: 'SIM-0926-03' })
    expect((await projects.getProject('PJ-DEMO')).inputs.simulation?.runId).toBe('SIM-0926-01')
  })

  it('прогон переживает отписку: подписчик, пришедший позже, видит текущее состояние через get', async () => {
    const { runs } = setup()
    const late: (SimulationRunProgress | null)[] = []
    runs.start('PJ-DEMO', REQUEST, { persist: false })
    await vi.advanceTimersByTimeAsync(1_500)
    const unsubscribe = runs.subscribe('PJ-DEMO', (p) => { late.push(p) })
    expect(runs.get('PJ-DEMO')?.status).toBe('running')
    await vi.advanceTimersByTimeAsync(10_000)
    unsubscribe()
    expect(late.at(-1)).toMatchObject({ status: 'done' })
  })

  it('дольше 60 с — ошибка «timeout», опрос прекращается (ТЗ 4.3.3)', async () => {
    const { projects } = setup()
    const endless: SimulationJob = { id: 'JOB-X', status: 'running', log: ['Идёт'], elapsedS: 0, runId: null, error: null }
    vi.spyOn(projects, 'startSimulation').mockResolvedValue({ ...endless, status: 'queued', log: [] })
    const poll = vi.spyOn(projects, 'getSimulationJob').mockImplementation(() => Promise.resolve(endless))
    const runs = createSimulationRuns(projects)
    runs.start('PJ-DEMO', REQUEST, { persist: true })
    await vi.advanceTimersByTimeAsync(61_000)
    expect(runs.get('PJ-DEMO')).toMatchObject({ status: 'error', reason: 'timeout' })
    const calls = poll.mock.calls.length
    await vi.advanceTimersByTimeAsync(5_000)
    expect(poll.mock.calls.length).toBe(calls)
  })

  it('ошибка задания — «failed» с текстом сервиса', async () => {
    const { projects } = setup()
    vi.spyOn(projects, 'getSimulationJob').mockResolvedValue({ id: 'JOB-1', status: 'error', log: ['Старт'], elapsedS: 2, runId: null, error: 'Нет данных о площадке' })
    const runs = createSimulationRuns(projects)
    runs.start('PJ-DEMO', REQUEST, { persist: true })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(runs.get('PJ-DEMO')).toMatchObject({ status: 'error', reason: 'failed', message: 'Нет данных о площадке', log: ['Старт'] })
  })

  it('«Остановить»: прогон забыт, события прежнего запуска не приходят, в черновик ничего не пишется', async () => {
    const { projects, runs, events } = setup()
    runs.start('PJ-DEMO', REQUEST, { persist: true })
    await vi.advanceTimersByTimeAsync(1_500)
    runs.stop('PJ-DEMO')
    expect(runs.get('PJ-DEMO')).toBeNull()
    expect(events.at(-1)).toBeNull()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(events.at(-1)).toBeNull()
    expect((await projects.getProject('PJ-DEMO')).inputs.simulation?.runId).toBe('SIM-0926-01')
  })

  it('сохранённая оценка — «failed» сразу (D-17)', async () => {
    const projects = createMockProjects({ latencyMs: 0 })
    const runs = createSimulationRuns(projects)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    runs.start('PJ-01', REQUEST, { persist: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(runs.get('PJ-01')).toMatchObject({ status: 'error', reason: 'failed' })
  })
})
