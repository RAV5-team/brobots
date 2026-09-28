import { describe, expect, it } from 'vitest'
import { CATALOG_REFRESH_RUN } from '@/mocks/fixtures/catalogRefresh'
import { refreshView } from './catalogRefreshModel'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')
const frame = (i: number) => {
  const f = CATALOG_REFRESH_RUN[i]
  if (f === undefined) throw new Error(`нет кадра ${String(i)}`)
  return f
}

describe('refreshView (экран А1а)', () => {
  it('reproduces the mockup state «2 из 3» with the per-source status line (16044:376)', () => {
    const view = refreshView(frame(1))
    expect(view.title).toBe('Опрашиваем источники · 2 из 3')
    expect(view.percent).toBeCloseTo(66.67, 1)
    expect(plain(view.detail)).toBe(
      'ФЦ БАС · catalog_export_v5.csv — получено 12 позиций · Ронави Роботикс — ждём ответа · Реестр Минпромторга — в очереди',
    )
  })

  it('declines the number of received positions and marks a silent source', () => {
    const view = refreshView(frame(3))
    expect(view.title).toBe('Опрашиваем источники · 3 из 3')
    expect(view.percent).toBe(100)
    expect(plain(view.detail)).toContain('Ронави Роботикс — получено 4 позиции')
    expect(view.detail).toContain('Реестр Минпромторга — не ответил')
  })

  it('shows zero progress when there is nothing to poll', () => {
    expect(refreshView({ sources: [] })).toEqual({ title: 'Опрашиваем источники · 0 из 0', percent: 0, detail: '' })
  })
})
