import { describe, expect, it } from 'vitest'
import type { HttpClient } from '@/api/http'
import { apiLocations } from './locations'
import type { Reference } from './reference'

describe('apiLocations page', () => {
  it('fetches GET /locations once when the list and summaries are asked together', async () => {
    let calls = 0
    const http = {
      get: (path: string) => {
        if (path !== '/locations') return Promise.reject(new Error(path))
        calls += 1
        return Promise.resolve({ items: [{ id: '1', name: 'РЦ', facilityTypeCode: 'warehouse', updatedAt: '2026-01-01T00:00:00Z' }] })
      },
    } as HttpClient
    const locations = apiLocations(http, {} as Reference)
    await Promise.all([
      locations.listLocations?.(),
      locations.listLocationSummaries?.(),
      locations.listLocations?.(),
      locations.listLocationSummaries?.(),
    ])
    expect(calls).toBe(1)

    await locations.listLocations?.()
    expect(calls).toBe(2)
  })
})
