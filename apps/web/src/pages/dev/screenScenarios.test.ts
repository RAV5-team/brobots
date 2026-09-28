import { describe, expect, it } from 'vitest'
import { SCREENS } from '@/app/screens'
import { createMockServices } from '@/services/mock'
import { SCREEN_SCENARIOS } from './screenScenarios'

const VERDICT_SCREENS = ['proto-07-confirmed', 'proto-07-can-reduce', 'proto-07-need-more', 'proto-07-layout', 'proto-07-unreachable']

describe('сценарии /dev/screens: вердикты симуляции', () => {
  it('у каждого вердикта PRD 11.4 есть строка экрана и сценарий', () => {
    expect(VERDICT_SCREENS.filter((id) => !SCREENS.some((s) => s.id === id) || !(id in SCREEN_SCENARIOS))).toEqual([])
  })

  it('сценарий подставляет демо-проекту прогон нужного вердикта и открывает шаг симуляции', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const scenario = SCREEN_SCENARIOS['proto-07-need-more']
    if (!scenario) throw new Error('нет сценария')
    const target = await scenario(services)
    expect(target.to).toBe('/projects/PJ-DEMO/simulation')
    const project = await services.projects.getProject('PJ-DEMO')
    expect(project.inputs.simulation).toMatchObject({ stage: 'verdict', runId: 'SIM-0926-03', fleet: { robots: 15, stations: 6 } })
    expect(project.inputs.stale.simulation).toBe(false)
    expect((await services.projects.getSimulationRun('SIM-0926-03')).verdict).toBe('need_more')
  })

  it('07a — «можно уменьшить» на вкладке графиков', async () => {
    const scenario = SCREEN_SCENARIOS['proto-07a']
    if (!scenario) throw new Error('нет сценария')
    expect(SCREENS.some((s) => s.id === 'proto-07a')).toBe(true)
    expect((await scenario(createMockServices({ latencyMs: 0 }))).to).toBe('/projects/PJ-DEMO/simulation?stage=verdict&tab=charts')
  })
})
