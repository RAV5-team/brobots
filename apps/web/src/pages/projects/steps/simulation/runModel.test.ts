import { describe, expect, it } from 'vitest'
import { runPercent, runStatusLine } from './runModel'

describe('этап «Моделирование»: полоса и строка состояния (3.3; D-103)', () => {
  it('полоса — время из лимита 60 с, пока идёт — не больше 99 %; готово — 100 %', () => {
    expect(runPercent({ status: 'running', log: [], elapsedS: 12 }, 60)).toBe(20)
    expect(runPercent({ status: 'running', log: [], elapsedS: 75 }, 60)).toBe(99)
    expect(runPercent({ status: 'done', log: [], elapsedS: 5, runId: 'SIM-1' }, 60)).toBe(100)
  })

  it('состав из подбора моделируется, варианты — в очереди', () => {
    const fleet = { robots: 18, stations: 6 }
    expect(runStatusLine('running', fleet, fleet)).toMatch(
      /^Конфигурация из подбора, как в расчёте: 18\sроботов, 6\sстанций — моделируется · Варианты с большим и меньшим парком — в очереди$/u,
    )
  })

  it('свой состав называется «для проверки»; готово — «проверена»', () => {
    expect(runStatusLine('done', { robots: 15, stations: 6 }, { robots: 18, stations: 6 })).toMatch(
      /^Конфигурация для проверки: 15\sроботов, 6\sстанций — проверена · Вердикт готов$/u,
    )
  })
})
