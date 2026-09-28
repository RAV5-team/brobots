import { describe, expect, it } from 'vitest'
import { API_SOURCES, isUpToDate } from './genApi'

describe('сгенерированные типы API', () => {
  it.each(API_SOURCES)('$output совпадает с $contract (иначе — npm run gen:api)', async (source) => {
    expect(await isUpToDate(source)).toBe(true)
  })
})
