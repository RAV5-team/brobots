import { describe, expect, it } from 'vitest'
import { barBox, rangeBox, shares, valueDomain } from './chartScale'

describe('valueDomain', () => {
  it('включает ноль: столбцы растут от нуля', () => {
    expect(valueDomain([20, 130, 86])).toEqual({ min: 0, max: 130 })
    expect(valueDomain([-6.1, 3.1, 39.9])).toEqual({ min: -6.1, max: 39.9 })
  })

  it('все нули — не делим на ноль', () => {
    expect(valueDomain([0, 0])).toEqual({ min: 0, max: 1 })
  })
})

describe('barBox — столбец в пикселях высоты графика', () => {
  it('положительный — от нулевой линии вверх', () => {
    expect(barBox(65, { min: 0, max: 130 }, 150)).toEqual({ top: 75, height: 75 })
  })

  it('отрицательный — от нулевой линии вниз', () => {
    const box = barBox(-10, { min: -10, max: 30 }, 160)
    expect(box).toEqual({ top: 120, height: 40 })
  })

  it('ноль — заглушка минимальной высоты на нулевой линии', () => {
    expect(barBox(0, { min: 0, max: 130 }, 150, 2)).toEqual({ top: 148, height: 2 })
  })
})

describe('shares — доли сегментов 100 %', () => {
  it('нормирует к единице', () => {
    expect(shares([1, 1, 2])).toEqual([0.25, 0.25, 0.5])
    expect(shares([0, 0])).toEqual([0, 0])
  })
})

describe('rangeBox — диапазон на общей шкале', () => {
  it('начало и ширина долей от максимума шкалы', () => {
    const box = rangeBox(0.4, 1.1, 1.1)
    expect(box.start).toBeCloseTo(0.4 / 1.1, 10)
    expect(box.width).toBeCloseTo(0.7 / 1.1, 10)
  })

  it('перевёрнутые границы и выход за шкалу приводятся к порядку и обрезаются', () => {
    expect(rangeBox(1.2, 0.5, 1)).toEqual({ start: 0.5, width: 0.5 })
  })
})
