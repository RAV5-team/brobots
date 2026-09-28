import { afterEach, describe, expect, it } from 'vitest'
import type { CompareEntry } from '@/domain'
import { ValidationError } from '../errors'
import { COMPARE_STORAGE_KEY, createMockCompare } from './compare'

const robot = (n: number): CompareEntry => ({ kind: 'robot', id: `RB-000${String(n)}` })
const item: CompareEntry = { kind: 'launch-item', id: 'SI-SW-01' }

afterEach(() => { sessionStorage.clear() })

describe('mock compare service (D-69)', () => {
  it('adds without duplicates and removes entries of both kinds', async () => {
    const compare = createMockCompare({ latencyMs: 0 })
    await compare.add('user', robot(1))
    await compare.add('user', robot(1))
    expect(await compare.add('user', item)).toEqual([robot(1), item])
    expect(await compare.remove('user', robot(1))).toEqual([item])
    expect(await compare.clear('user')).toEqual([])
  })

  it('refuses the fifth entry (D-58: up to 4)', async () => {
    const compare = createMockCompare({ latencyMs: 0 })
    for (const n of [1, 2, 3, 4]) await compare.add('user', robot(n))
    await expect(compare.add('user', robot(5))).rejects.toBeInstanceOf(ValidationError)
    expect(await compare.list('user')).toHaveLength(4)
  })

  it('keeps the set of a user in sessionStorage for the browser session', async () => {
    await createMockCompare({ latencyMs: 0 }).add('user', robot(1))
    expect(JSON.parse(sessionStorage.getItem(COMPARE_STORAGE_KEY) ?? '[]')).toEqual([robot(1)])
    expect(await createMockCompare({ latencyMs: 0 }).list('admin')).toEqual([robot(1)])
  })

  it('does not save the set of a guest (ТЗ 3.1.2)', async () => {
    const compare = createMockCompare({ latencyMs: 0 })
    await compare.add('guest', robot(1))
    expect(sessionStorage.getItem(COMPARE_STORAGE_KEY)).toBeNull()
    expect(await compare.list('guest')).toEqual([robot(1)])
    expect(await createMockCompare({ latencyMs: 0 }).list('guest')).toEqual([])
  })

  it('ignores a broken or foreign stored value', async () => {
    sessionStorage.setItem(COMPARE_STORAGE_KEY, '{"oops":1}')
    expect(await createMockCompare({ latencyMs: 0 }).list('user')).toEqual([])
    sessionStorage.setItem(COMPARE_STORAGE_KEY, '[{"kind":"robot","id":"RB-0001"},{"kind":"x","id":1},"y"]')
    expect(await createMockCompare({ latencyMs: 0 }).list('user')).toEqual([robot(1)])
  })
})
