import { describe, expect, it } from 'vitest'
import { toSimulationRun } from '@/api/mappers/simulation'
import type { HourlyStat } from '@/domain'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { boardFleets, boardHourly, chartFleets, clockOf, fromShiftStart, hasViolation, hourViolations, hourlyRows, initialTime, timeSegments, tripShare } from './chartsModel'

const run = (status: string) => {
  const dto = SIMULATION_RUNS.find((r) => r.status === status)
  if (!dto) throw new Error(status)
  return toSimulationRun(dto)
}
const TARGETS = { onTimeTarget: 0.95, maxWaitMin: 10 }
const hour = (patch: Partial<HourlyStat>): HourlyStat => ({
  hour: 8, demand: 130, done: 130, onTime: 0.97, waitMeanMin: 4, working: 15, charging: 1, waitingCharger: 0, down: 0, idle: 2,
  utilization: 0.83, backlogMax: 7, chargersBusy: 0.2, ...patch,
})

describe('время парка по сегментам', () => {
  it('состояния движка складываются в шесть сегментов; «в рейсе» — везёт и едет за паллетой', () => {
    const segments = timeSegments({ to_drop: 0.2, loading: 0.05, unloading: 0.05, to_pickup: 0.2, blocked: 0.05, queue: 0.05, charging: 0.1, down: 0.05, idle: 0.25 })
    expect(segments).toEqual({ carrying: 0.3, toPickup: 0.2, blocked: 0.1, charging: 0.1, down: 0.05, idle: 0.25 })
    expect(segments && tripShare(segments)).toBeCloseTo(0.5)
  })

  it('пустые доли — нет данных, неизвестное состояние — «свободен»', () => {
    expect(timeSegments({})).toBeNull()
    expect(timeSegments({ parked: 1 })?.idle).toBe(1)
  })

  it('доли фикстур сходятся к 1 у обоих составов', () => {
    const r = run('can_reduce')
    for (const shares of [r.fleetShares, r.before.fleetShares]) {
      const segments = timeSegments(shares)
      expect(segments && Object.values(segments).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2)
    }
  })
})

describe('составы вкладки', () => {
  it('можно уменьшить: из подбора и «с уменьшением» со своими рядами и долями', () => {
    const r = run('can_reduce')
    const fleets = chartFleets(r, { robots: 18, stations: 6 })
    expect(fleets.map((f) => [f.key, f.title, f.fleet.robots])).toEqual([['before', 'Из подбора', 18], ['after', 'С уменьшением', 16]])
    expect(fleets[0]?.hours).toBe(r.hourlyBefore)
    expect(fleets[1]?.shares).toBe(r.fleetShares)
  })

  it('проверен не состав подбора — «Проверено»; один состав — одна запись', () => {
    expect(chartFleets(run('needs_additions'), { robots: 18, stations: 6 }).map((f) => f.title)).toEqual(['Проверено', 'С докупкой'])
    expect(chartFleets(run('confirmed'), { robots: 18, stations: 6 }).map((f) => f.title)).toEqual(['Из подбора'])
  })
})

describe('нарушения часа', () => {
  it('выполнено меньше потребности, занятость выше 95 %, в срок ниже цели, ожидание дольше предела', () => {
    expect(hasViolation(hourViolations(hour({}), TARGETS))).toBe(false)
    expect(hourViolations(hour({ done: 122 }), TARGETS).done).toBe(true)
    expect(hourViolations(hour({ utilization: 0.97 }), TARGETS).utilization).toBe(true)
    expect(hourViolations(hour({ onTime: 0.94 }), TARGETS).onTime).toBe(true)
    expect(hourViolations(hour({ waitMeanMin: 12 }), TARGETS).waitMean).toBe(true)
    expect(hasViolation(hourViolations(hour({ onTime: null, waitMeanMin: null, demand: 0, done: 0 }), TARGETS))).toBe(false)
  })

  it('строки таблицы: восемь показателей, нарушение — только в своей строке, пустой час — прочерк', () => {
    const rows = hourlyRows([hour({ utilization: 0.97 }), hour({ hour: 5, demand: 0, done: 0, onTime: null, waitMeanMin: null, utilization: 0 })], TARGETS)
    expect(rows.map((r) => r.key)).toEqual(['demand', 'done', 'utilization', 'idle', 'charging', 'waitingCharger', 'waitMean', 'onTime'])
    const utilization = rows.find((r) => r.key === 'utilization')
    expect(utilization?.cells).toEqual([{ value: '97', violation: true }, { value: '0', violation: false }])
    expect(rows.find((r) => r.key === 'onTime')?.cells[1]).toEqual({ value: '—', violation: false })
  })
})

describe('часы плеера', () => {
  it('время записи → часы объекта от начала записи, через полночь', () => {
    expect(clockOf(7, 0)).toEqual({ hour: 7, label: '07:00' })
    expect(clockOf(7, 3600 + 12 * 60)).toEqual({ hour: 8, label: '08:12' })
    expect(clockOf(7, 17 * 3600 + 30)).toEqual({ hour: 0, label: '00:00' })
  })

  it('старт — первый пиковый час после начала записи; пиков нет — начало', () => {
    const r = run('confirmed')
    expect(initialTime(7, r.hourlyAfter, r, 23 * 3600)).toBe(3600)
    expect(initialTime(7, [], r, 23 * 3600)).toBe(0)
  })
})

describe('доска 3.5: составы, часы от начала смены, таблица по составам', () => {
  const targets = { onTimeTarget: 0.95, maxWaitMin: 10 }
  const reduce = run('can_reduce')

  it('второй состав — всегда «С изменениями»; первый — «Из подбора»', () => {
    expect(boardFleets(reduce, reduce.from).map((f) => f.title)).toEqual(['Из подбора', 'С изменениями'])
  })

  it('часы — от начала первой смены: 07 … 06', () => {
    const hours = fromShiftStart(reduce.hourlyBefore, 7)
    expect(hours[0]?.hour).toBe(7)
    expect(hours.at(-1)?.hour).toBe(6)
    expect(hours).toHaveLength(reduce.hourlyBefore.length)
  })

  it('таблица: общая «Потребность», группы нагрузки и результата, строка на состав; требования — из условий', () => {
    const table = boardHourly(boardFleets(reduce, reduce.from), targets, 7)
    expect(table.columns[0]).toBe('07')
    expect(table.groups.map((g) => g.metrics.map((m) => m.key))).toEqual([
      ['utilization', 'idle', 'waitingCharger', 'charging'],
      ['done', 'waitMean', 'onTime'],
    ])
    const onTime = table.groups[1]?.metrics[2]
    expect(onTime?.requirement).toMatch(/^требование — от 95\s%$/u)
    expect(onTime?.rows.map((r) => r.label)).toEqual(['Из подбора', 'С изменениями'])
    expect(table.groups[1]?.metrics[1]?.requirement).toBe('требование — до 10 мин')
  })
})
