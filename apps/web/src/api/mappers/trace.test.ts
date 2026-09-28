import { describe, expect, it } from 'vitest'
import { ContractError } from '../contract'
import { toSimulationTrace } from './trace'

const dto = {
  name: 'Из подбора: 18/6', step_s: 15, n_robots: 1, n_chargers: 1, clock_offset_h: 7,
  states: ['idle', 'to_drop'], state_ru: { idle: 'свободен' }, state_colors: {},
  layout: {
    nodes: [{ id: 'J0', x: 2.5, y: 0, type: 'junction' }, { id: 'CHG', x: 75.5, y: -3, type: 'charger' }],
    edges: [{ u: 'J0', v: 'CHG', length: 5, lanes: 2, kind: 'main' }],
    charger_slots: [[75.5, -3]], width: 70.7, depth: 141.4, charger_node: 'CHG',
  },
  frames: [{ t: 0, r: [[2.5, 0, 0]], done: 0, backlog: 0, ch: 0, chq: 0, soc: 1 }],
}

describe('toSimulationTrace — формат simcore.viz.export_trace', () => {
  it('переводит трассу в модель плеера', () => {
    expect(toSimulationTrace(dto)).toEqual({
      name: 'Из подбора: 18/6', stepS: 15, robots: 1, chargers: 1, clockOffsetH: 7, states: ['idle', 'to_drop'],
      layout: {
        nodes: [{ id: 'J0', x: 2.5, y: 0, type: 'junction' }, { id: 'CHG', x: 75.5, y: -3, type: 'charger' }],
        edges: [{ from: 'J0', to: 'CHG', kind: 'main' }],
        chargerSlots: [[75.5, -3]], width: 70.7, depth: 141.4,
      },
      frames: [{ t: 0, robots: [[2.5, 0, 0]] }],
    })
  })

  it('нет кадров или число роботов в кадре не совпадает — ошибка контракта', () => {
    expect(() => toSimulationTrace({ ...dto, frames: undefined })).toThrow(ContractError)
    expect(() => toSimulationTrace({ ...dto, frames: [{ t: 0, r: [] }] })).toThrow('Trace: в кадре 0 роботов 0, ожидалось 1')
  })

  it('не объект — ошибка контракта', () => {
    expect(() => toSimulationTrace(null)).toThrow('Trace: ответ не объект')
  })
})
