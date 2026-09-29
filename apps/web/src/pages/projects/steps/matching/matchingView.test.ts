import { describe, expect, it } from 'vitest'
import { matchingViewState, readMatchingView } from './matchingView'

describe('вид шага 2 из состояния навигации (/dev/screens)', () => {
  it('читает «всё раскрыто» и ключи сравнения', () => {
    expect(readMatchingView(matchingViewState({ expandAll: true }))).toEqual({ expandAll: true })
    expect(readMatchingView(matchingViewState({ compare: ['RB-0008:raas'] }))).toEqual({ compare: ['RB-0008:raas'] })
  })

  it('чужое, пустое или битое состояние — обычный вид', () => {
    expect(readMatchingView(null)).toEqual({})
    expect(readMatchingView({ createdLocationId: 'LOC-01' })).toEqual({})
    expect(readMatchingView({ matchingView: { expandAll: 'да', compare: [1] } })).toEqual({})
  })
})
