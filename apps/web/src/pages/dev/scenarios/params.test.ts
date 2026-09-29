import { describe, expect, it } from 'vitest'
import { createMockServices } from '@/services/mock'
import { isParamsExpandedState } from '@/pages/projects/steps/params/useGroupReveal'
import { PARAMS_SCENARIOS } from './params'

describe('сценарии шага 1 (/dev/screens)', () => {
  it('board-1.5: PJ-07 на инвентаризации, группы раскрыты, процесс не меняется', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const target = await PARAMS_SCENARIOS['board-1.5']?.(services)
    expect(target?.to).toBe('/projects/PJ-07/params')
    expect(isParamsExpandedState(target?.state)).toBe(true)
    expect((await services.projects.getProject('PJ-07')).locationProcessId).toBe('LP-05')
  })

  it.each([['board-1.2', 'LP-02', true], ['board-1.3', 'LP-03', false], ['board-1.4', 'LP-04', false]] as const)('%s: выбран процесс %s, группы раскрыты', async (id, processId, breakdown) => {
    const services = createMockServices({ latencyMs: 0 })
    const scenario = PARAMS_SCENARIOS[id]
    if (!scenario) throw new Error(id)
    const target = await scenario(services)
    expect(target.to).toBe('/projects/PJ-DEMO/params')
    expect(isParamsExpandedState(target.state) && target.state).toMatchObject({ siteAll: false, breakdown })
    expect((await services.projects.getProject('PJ-DEMO')).locationProcessId).toBe(processId)
  })
})
