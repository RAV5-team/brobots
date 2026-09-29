import { describe, expect, it } from 'vitest'
import type { HttpClient } from '@/api/http'
import type { ApiSchemas } from '@/api/contract'
import { PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { NotFoundError } from '../errors'
import { apiProcesses } from './processes'
import type { Reference } from './reference'

function httpReturning(values: readonly { readonly code: string; readonly value: number }[]): HttpClient {
  return {
    get: async (path) => {
      if (path !== '/norms') throw new Error(path)
      return { values }
    },
  } as HttpClient
}

describe('apiProcesses.getTemplateDefaults', () => {
  it('takes the aisle margin from the norms catalog and the rest from the form defaults', async () => {
    const defaults = await apiProcesses(httpReturning([{ code: 'width_margin_m', value: 0.4 }]), {} as Reference).getTemplateDefaults?.()
    expect(defaults).toEqual({ ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: 0.4 })
  })

  it('uses 0.6 m when the catalog has no aisle-margin norm', async () => {
    const defaults = await apiProcesses(httpReturning([]), {} as Reference).getTemplateDefaults?.()
    expect(defaults?.widthMarginM).toBe(0.6)
  })
})

describe('apiProcesses.getRequirements', () => {
  const processes = apiProcesses({} as HttpClient, {
    processes: async () => [{
      code: 'PR-0099',
      name: 'Свой процесс',
      defaults: { unitMassKg: 800, routeLengthM: 40 },
    } as ApiSchemas['Process']],
  } as Reference)

  it('derives location requirements from the process fields', async () => {
    const requirements = await processes.getRequirements?.('PR-0099')
    expect(requirements?.required.map((item) => item.code)).toEqual(['maxMass', 'routeWidth'])
    expect(requirements?.desirable.map((item) => item.code)).toEqual(['avgDistance', 'peakFactor'])
    expect(requirements?.environment).toHaveLength(5)
  })

  it('rejects an unknown process', async () => {
    await expect(processes.getRequirements?.('PR-0000')).rejects.toBeInstanceOf(NotFoundError)
  })
})
