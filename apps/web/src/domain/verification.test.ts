import { describe, expect, it } from 'vitest'
import { verificationOf } from './verification'

describe('статус проверки в проектном виде', () => {
  it('статусы каталога переходят в проектные; нет данных — «требует проверки»', () => {
    expect(verificationOf('confirmed')).toBe('confirmed')
    expect(verificationOf('estimate')).toBe('estimate')
    expect(verificationOf('missing')).toBe('needs_check')
  })
})
