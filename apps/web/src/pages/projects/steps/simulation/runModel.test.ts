import { describe, expect, it } from 'vitest'
import { runPercent, runSteps } from './runModel'

const fleet = { robots: 18, stations: 6 }

describe('этап «Моделирование»: полоса и журнал шагов (3.3; D-103)', () => {
  it('полоса — время из лимита 60 с, пока идёт — не больше 99 %; готово — 100 %', () => {
    expect(runPercent({ status: 'running', log: [], elapsedS: 12 }, 60)).toBe(20)
    expect(runPercent({ status: 'running', log: [], elapsedS: 75 }, 60)).toBe(99)
    expect(runPercent({ status: 'done', log: [], elapsedS: 5, runId: 'SIM-1' }, 60)).toBe(100)
  })

  it('пока журнал пуст: состав моделируется, варианты — отдельной строкой в очереди', () => {
    const steps = runSteps({ status: 'running', log: [], elapsedS: 1 }, fleet, fleet)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.text).toMatch(/^Конфигурация из подбора, как в расчёте: 18\sроботов, 6\sстанций — моделируются рабочие сутки$/u)
    expect(steps[0]?.state).toBe('current')
    expect(steps[1]).toEqual({ text: 'В очереди: варианты с большим и меньшим парком, затем сводный вердикт', state: 'queued' })
  })

  it('пришедшие строки сделаны, последняя идёт; очередь остаётся, пока нет вердикта', () => {
    const steps = runSteps({ status: 'running', log: ['Смоделированы сутки: пик 130 рейсов/ч', 'Маршруты и зарядка: роботов 18, станций 6'], elapsedS: 2 }, fleet, fleet)
    expect(steps.map((step) => step.state)).toEqual(['done', 'current', 'queued'])
    expect(steps[0]?.text).toBe('Смоделированы сутки: пик 130 рейсов/ч')
    expect(steps[2]?.text).toMatch(/В очереди/)
  })

  it('строка про вердикт закрывает очередь; готовый прогон — все шаги сделаны', () => {
    const running = runSteps({ status: 'running', log: ['Сводный вердикт по худшему дню'], elapsedS: 4 }, fleet, fleet)
    expect(running).toEqual([{ text: 'Сводный вердикт по худшему дню', state: 'current' }])
    expect(runSteps({ status: 'done', log: ['Смоделированы сутки', 'Сводный вердикт'], elapsedS: 5, runId: 'SIM-1' }, fleet, fleet)).toEqual([
      { text: 'Смоделированы сутки', state: 'done' },
      { text: 'Сводный вердикт', state: 'done' },
    ])
  })

  it('свой состав называется «для проверки»; без журнала готовый прогон — одна строка', () => {
    const steps = runSteps({ status: 'done', log: [], elapsedS: 5, runId: 'SIM-1' }, { robots: 15, stations: 6 }, fleet)
    expect(steps).toHaveLength(1)
    expect(steps[0]?.text).toMatch(/^Конфигурация для проверки: 15\sроботов, 6\sстанций — проверена · Вердикт готов$/u)
    expect(steps[0]?.state).toBe('done')
  })
})
