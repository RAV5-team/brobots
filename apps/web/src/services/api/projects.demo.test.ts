import { describe, expect, it } from 'vitest'
import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { DEMO_PROJECT_DTO } from '@/mocks/fixtures/projects'
import { ConflictError } from '../errors'
import { createDemoSession } from './demoSession'
import { apiProjects } from './projects'

type Call = readonly [method: string, path: string, body?: unknown]

/** services/api для демо-проекта: чтение — из сида, запись — только preview (ролевая модель, §5). */
function fakeApi(dto: ApiSchemas['Project'] = { ...DEMO_PROJECT_DTO, step: 'economics' }) {
  const calls: Call[] = []
  const http = {
    get: (path: string) => {
      calls.push(['GET', path])
      if (path === `/projects/${dto.id ?? ''}`) return Promise.resolve(dto)
      if (path.endsWith('/evaluation')) return Promise.resolve(EVALUATION_LP01)
      if (path.startsWith('/preview/simulation-runs/')) {
        return Promise.resolve({ id: path.split('/')[3], status: 'done', log: ['Вердикт'], elapsedS: 3, assumptions: [] })
      }
      return Promise.reject(new Error(`GET ${path}`))
    },
    post: (path: string, body?: unknown) => {
      calls.push(['POST', path, body])
      if (path.endsWith('/preview')) return Promise.resolve(EVALUATION_LP01)
      if (path.endsWith('/preview/simulation-runs')) {
        return Promise.resolve({ id: '0123456789abcdef0123456789abcdef', status: 'queued', log: [], elapsedS: 0, assumptions: [] })
      }
      return Promise.reject(new Error(`POST ${path}`))
    },
    put: (path: string, body?: unknown) => { calls.push(['PUT', path, body]); return Promise.resolve(undefined) },
    patch: (path: string, body?: unknown) => { calls.push(['PATCH', path, body]); return Promise.resolve(dto) },
  } as unknown as HttpClient
  const deps = { catalog: {}, locations: {}, processes: {}, demo: createDemoSession(null) } as unknown as Parameters<typeof apiProjects>[1]
  return { projects: apiProjects(http, deps), calls, writes: () => calls.filter(([m, p]) => m !== 'GET' && !p.includes('/preview')) }
}

describe('apiProjects · демо-проект гостя (ролевая модель, §5)', () => {
  it('начальный выбор — из сида: вариант и его сценарий итога', async () => {
    const { projects } = fakeApi()
    const project = await projects.getProject?.('PJ-DEMO')
    expect(project?.isDemo).toBe(true)
    expect(project?.inputs.matching?.selection).toEqual({ solutionId: 'RB-0008', acquisition: 'raas' })
    expect(project?.inputs.economics?.scenario).toBe('raas')
  })

  it('решения шагов живут в браузере: сервер не меняется', async () => {
    const { projects, writes } = fakeApi()
    await projects.updateInputs?.('PJ-DEMO', { matching: { selection: { solutionId: 'RB-0001', acquisition: 'purchase' } } })
    const project = await projects.getProject?.('PJ-DEMO')
    expect(project?.inputs.matching?.selection).toEqual({ solutionId: 'RB-0001', acquisition: 'purchase' })
    await projects.openStep?.('PJ-DEMO', 'simulation')
    expect(writes()).toEqual([])
  })

  it('пересчёт идёт в preview с «Параметрами расчёта» гостя и становится цифрами шагов', async () => {
    const { projects, calls, writes } = fakeApi()
    await projects.updateInputs?.('PJ-DEMO', { matching: { calcParams: { workHoursPerDay: 12 } } })
    await projects.evaluateMatching?.('PJ-DEMO')
    expect(calls.find(([m, p]) => m === 'POST' && p === '/projects/PJ-DEMO/preview')?.[2])
      .toEqual({ calcOverrides: { workHoursPerDay: 12, solutionId: 'RB-0008' } })
    const project = await projects.getProject?.('PJ-DEMO')
    expect(project?.inputs.stale.matching).toBe(false)
    const reads = calls.filter(([m, p]) => m === 'GET' && p.endsWith('/evaluation')).length
    await projects.getMatching?.('PJ-DEMO')
    // Подбор читается из пересчёта гостя, а не из сида.
    expect(calls.filter(([m, p]) => m === 'GET' && p.endsWith('/evaluation'))).toHaveLength(reads)
    expect(writes()).toEqual([])
  })

  it('симуляция — гостевой прогон по выбранному варианту, ход и результат по его заданию', async () => {
    const { projects, calls } = fakeApi()
    const job = await projects.startSimulation?.('PJ-DEMO', { fleet: { robots: 18, stations: 5 }, conditions: {} })
    expect(calls.at(-1)).toEqual(['POST', '/projects/PJ-DEMO/preview/simulation-runs', expect.objectContaining({
      solutionId: 'RB-0008', acquisitionModel: 'raas', fleet: { robots: 18, stations: 5 },
    })])
    const polled = await projects.getSimulationJob?.(job?.id ?? '')
    expect(polled).toMatchObject({ status: 'done', runId: '0123456789abcdef0123456789abcdef' })
    expect(calls.at(-1)).toEqual(['GET', '/preview/simulation-runs/0123456789abcdef0123456789abcdef'])
  })

  it('сохранить оценку и сменить процесс в демо нельзя — понятный отказ', async () => {
    const { projects } = fakeApi()
    await expect(projects.save?.('PJ-DEMO')).rejects.toBeInstanceOf(ConflictError)
    await expect(projects.selectProcess?.('PJ-DEMO', 'LP-02')).rejects.toBeInstanceOf(ConflictError)
  })

  it('список: гостю — демо-проекты, вошедшему — свои', async () => {
    const own = { ...DEMO_PROJECT_DTO, id: 'PJ-OWN', isDemo: false }
    const http = { get: () => Promise.resolve({ items: [DEMO_PROJECT_DTO, own] }) } as unknown as HttpClient
    const projects = apiProjects(http, { catalog: {}, locations: {}, processes: {} } as unknown as Parameters<typeof apiProjects>[1])
    expect((await projects.listProjects?.({ demo: true }))?.map((p) => p.id)).toEqual(['PJ-DEMO'])
    expect((await projects.listProjects?.())?.map((p) => p.id)).toEqual(['PJ-OWN'])
  })
})
