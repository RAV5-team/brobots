import { describe, expect, it } from 'vitest'
import { paramsReadiness, type MissingValue } from './projectParams'

const site = (code: string): MissingValue => ({ code, scope: 'site', impact: 'needs_check' })

describe('paramsReadiness — правила готовности к подбору (PRD 11.2)', () => {
  it('нет данных площадки — подбор выполним, решения получат «Требует проверки»', () => {
    const readiness = paramsReadiness([site('site_floor_load_tm2'), site('site_wifi_coverage')], 4)
    expect(readiness).toMatchObject({ canMatch: true, missingCount: 2, assumptionsCount: 4 })
    expect(readiness.siteChecks.map((m) => m.code)).toEqual(['site_floor_load_tm2', 'site_wifi_coverage'])
  })

  it('нормативы считаются отдельно от допущений и не меняют их счётчик; не переданы — 0', () => {
    expect(paramsReadiness([], 4, 1)).toMatchObject({ assumptionsCount: 4, normsCount: 1 })
    expect(paramsReadiness([], 4).normsCount).toBe(0)
  })

  it('нет оклада — подбор выполним, экономия труда не рассчитается', () => {
    const readiness = paramsReadiness([{ code: 'salary', scope: 'process', impact: 'no_labor_saving' }], 2)
    expect(readiness.canMatch).toBe(true)
    expect(readiness.laborSaving).toHaveLength(1)
  })

  it('нет значения, без которого не посчитать парк, — подбор недоступен', () => {
    const readiness = paramsReadiness([{ code: 'recountsPerMonth', scope: 'process', impact: 'blocks' }, site('site_wifi_coverage')], 3)
    expect(readiness.canMatch).toBe(false)
    expect(readiness.blocking.map((m) => m.code)).toEqual(['recountsPerMonth'])
  })
})
