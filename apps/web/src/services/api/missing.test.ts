import { describe, expect, it } from 'vitest'
import { MissingApiError } from '../errors'
import { composeServices } from '.'
import { apiGaps, createMissingServices } from './missing'

describe('createMissingServices', () => {
  it('rejects a method the API does not implement and records the gap', async () => {
    const services = composeServices(createMissingServices(), {})
    await expect(services.locations.listLocationDocuments('x')).rejects.toBeInstanceOf(MissingApiError)
    expect(apiGaps()).toContain('locations.listLocationDocuments')
    expect(apiGaps()).toBe(apiGaps())
  })
})
