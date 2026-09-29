import { describe, expect, it, vi } from 'vitest'
import { createMockServices } from '../mock'
import { composeServices } from '.'

describe('composeServices', () => {
  it('uses API methods where they exist and the fallback elsewhere', async () => {
    const fallback = createMockServices({ latencyMs: 0 })
    const listRobots = vi.fn(() => Promise.resolve([]))
    const services = composeServices(fallback, { catalog: { listRobots } })

    await expect(services.catalog.listRobots()).resolves.toEqual([])
    expect(listRobots).toHaveBeenCalledOnce()
    await expect(services.catalog.getRobot('RB-0008')).resolves.toMatchObject({ id: 'RB-0008' })
  })

  it('runs simulations over the composed project service', () => {
    const fallback = createMockServices({ latencyMs: 0 })
    const services = composeServices(fallback, {})
    expect(services.simulationRuns).not.toBe(fallback.simulationRuns)
    expect(services.simulationRuns.get('PJ-01')).toBeNull()
  })
})
