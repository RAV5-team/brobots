import { describe, expect, it } from 'vitest'
import type { ProjectId } from '@/domain'
import { createMockServices } from '@/services/mock'
import { applicabilityRows, reportContext, tradeoffText, type ReportContext } from './reportModel'

async function demoContext(id: ProjectId = 'PJ-DEMO', isGuest = false): Promise<ReportContext> {
  const services = createMockServices({ latencyMs: 0 })
  const project = await services.projects.getProject(id)
  const [location, economics, matching, snapshot] = await Promise.all([
    services.locations.getLocation(project.locationId),
    services.projects.getEconomics(id),
    services.projects.getMatching(id),
    services.projects.getParamsSnapshot(id),
  ])
  const ctx = reportContext({ project, location, economics, matching, snapshot, run: null }, isGuest)
  if (!ctx) throw new Error('нет сценария')
  return ctx
}

describe('reportModel', () => {
  it('контекст берёт выбранный сценарий и режим просмотра', async () => {
    const ctx = await demoContext()
    expect(ctx.selected).toBe('raas')
    expect(ctx.mode).toBe('draft')
    expect(ctx.others.map((s) => s.acquisition)).toEqual(['purchase'])
    expect((await demoContext('PJ-DEMO', true)).mode).toBe('guest')
  })

  it('главный компромисс: ниже вложения, но выше TCO — и наоборот', async () => {
    const ctx = await demoContext()
    const other = ctx.others[0]
    if (!other) throw new Error('нет альтернативы')
    const withTco = (tco: number): ReportContext => ({ ...ctx, scenario: { ...ctx.scenario, tcoRub: tco } })
    expect(tradeoffText(withTco((other.tcoRub ?? 0) + 10_000_000))).toMatch(/^RaaS: вложения ниже на .*, но TCO за 5\sлет выше на 10,0\sмлн/u)
    const pricier: ReportContext = { ...ctx, scenario: { ...ctx.scenario, capexRub: other.capexRub + 1_000_000, tcoRub: (other.tcoRub ?? 0) - 5_000_000 } }
    expect(tradeoffText(pricier)).toMatch(/^RaaS: TCO за 5\sлет ниже на 5,0\sмлн.*вложения выше на 1,0\sмлн/u)
    expect(tradeoffText({ ...ctx, others: [] })).toBe('Альтернативного сценария нет')
  })

  it('матрица применимости без проверок расчёта: условия отбора пройдены, условия площадки — нет данных', async () => {
    const ctx = await demoContext()
    const rows = applicabilityRows(ctx)
    const applicable = ctx.matching.conditions.filter((c) => c.applicable).length
    expect(rows.slice(0, applicable).every((r) => r.status === 'pass')).toBe(true)
    expect(rows.slice(applicable).map((r) => r.status)).toEqual(rows.slice(applicable).map(() => 'unknown'))
    expect(applicabilityRows({ ...ctx, variant: null })).toEqual([])
  })
})
