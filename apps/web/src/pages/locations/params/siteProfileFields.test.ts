import { describe, expect, it } from 'vitest'
import { siteFieldErrors, siteParametersOf } from './siteProfileFields'

describe('siteProfileFields', () => {
  it('keeps empty site values out of the profile', () => {
    expect(siteParametersOf({ site_wifi_coverage: '', site_aisle_min_m: '  ' })).toEqual({})
  })

  it('parses numbers and keeps select text', () => {
    expect(siteParametersOf({ site_aisle_min_m: '2,8', site_wifi_coverage: 'частично' })).toEqual({
      site_aisle_min_m: { value: 2.8, source: 'user' },
      site_wifi_coverage: { value: 'частично', source: 'user' },
    })
  })

  it('rejects a number outside the PRD 10.6 range', () => {
    expect(siteFieldErrors({ site_aisle_min_m: '9' }).site_aisle_min_m).toMatch(/от 1 до 6/)
  })
})
