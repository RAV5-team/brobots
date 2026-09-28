import { describe, expect, it } from 'vitest'
import { runLogLines, runPercent } from './runModel'

describe('этап «Прогон»: полоса и журнал (D-103)', () => {
  it('полоса — время из лимита 60 с, пока идёт — не больше 99 %; готово — 100 %', () => {
    expect(runPercent({ status: 'running', log: [], elapsedS: 12 }, 60)).toBe(20)
    expect(runPercent({ status: 'running', log: [], elapsedS: 75 }, 60)).toBe(99)
    expect(runPercent({ status: 'done', log: [], elapsedS: 5, runId: 'SIM-1' }, 60)).toBe(100)
  })

  it('журнал: до первой строки — очередь; последняя строка текущая; готово — все выполнены', () => {
    expect(runLogLines({ status: 'running', log: [], elapsedS: 0 }, 'очередь')).toEqual([{ text: 'очередь', state: 'current' }])
    expect(runLogLines({ status: 'running', log: ['a', 'b'], elapsedS: 2 }, 'очередь')).toEqual([
      { text: 'a', state: 'done' },
      { text: 'b', state: 'current' },
    ])
    expect(runLogLines({ status: 'done', log: ['a', 'b'], elapsedS: 3, runId: 'SIM-1' }, 'очередь').map((l) => l.state)).toEqual(['done', 'done'])
  })
})
