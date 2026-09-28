import { describe, expect, it } from 'vitest'
import { toEconomics } from '@/api/mappers/economics'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { breakEvenYear, effectChain, lowestOf, sensitivity, shiftedResult, staffEquivalent } from './economicsModel'

const M = 1_000_000
const economics = toEconomics(EVALUATION_LP01, 'RB-0008', { conditions: [], operationsPerDay: 2000 })
const scenario = (acq: 'raas' | 'purchase') => {
  const found = economics.scenarios.find((s) => s.acquisition === acq)
  if (!found) throw new Error(`нет сценария ${acq}`)
  return found
}
const raas = scenario('raas')
const purchase = scenario('purchase')
const round1 = (value: number) => Math.round(value / 100_000) / 10

describe('effectChain — «Из чего складываются затраты и эффект» (PRD 11.5)', () => {
  it('RaaS: 51,2 − 16,7 − 2,8 + 10,3 = 42,0, эффект 9,2 млн ₽', () => {
    const chain = effectChain(raas, economics.current)
    expect([chain.currentRub, chain.laborSavingsRub, chain.otherEffectRub, chain.newCostsRub, chain.afterRub, chain.effectRub].map(round1))
      .toEqual([51.2, 16.7, 2.8, 10.3, 42, 9.2])
  })

  it('покупка: новые расходы 2,8 (ТО, ПО, электроэнергия), после внедрения 34,5', () => {
    const chain = effectChain(purchase, economics.current)
    expect([chain.otherEffectRub, chain.newCostsRub, chain.afterRub, chain.effectRub].map(round1)).toEqual([2.8, 2.8, 34.5, 16.7])
  })
})

describe('staffEquivalent и breakEvenYear', () => {
  it('16,7 млн ₽ при окладе 120 000 ₽ — 8,9 ставки, «≈ 9»', () => {
    expect(staffEquivalent(16.7 * M, 120_000)).toBeCloseTo(8.9, 1)
  })

  it('выход в плюс: 0,7 года — год 1, 2,8 года — год 3, не окупается — нет', () => {
    expect(breakEvenYear(0.7)).toBe(1)
    expect(breakEvenYear(2.8)).toBe(3)
    expect(breakEvenYear(null)).toBeNull()
  })
})

describe('shiftedResult — строки PRD 11.5 «Устойчивость результата» (RaaS)', () => {
  const at = (parameter: 'price' | 'labor' | 'volume', shift: number) => shiftedResult(raas, economics.current, 5, parameter, shift)

  it('тариф RaaS −20 % / +20 %: окупаемость 0,5 / 0,8 года, TCO 206,2 / 226,0 млн ₽', () => {
    expect(at('price', -0.2).paybackYears).toBeCloseTo(0.55, 2)
    expect(at('price', 0.2).paybackYears).toBeCloseTo(0.84, 2)
    expect(round1(at('price', -0.2).tcoRub)).toBe(206.2)
    expect(round1(at('price', 0.2).tcoRub)).toBe(226)
  })

  it('стоимость труда −20 % / +20 %: окупаемость 1,0 / 0,5 года, TCO 185,9 / 246,3 млн ₽', () => {
    expect(at('labor', -0.2).paybackYears).toBeCloseTo(1.04, 2)
    expect(at('labor', 0.2).paybackYears).toBeCloseTo(0.49, 2)
    expect(round1(at('labor', -0.2).tcoRub)).toBe(185.9)
    expect(round1(at('labor', 0.2).tcoRub)).toBe(246.3)
  })

  it('объём −20 % / +20 %: парк 15 / 22 (в PRD тоже), станции в той же пропорции', () => {
    expect(at('volume', -0.2).robots).toBe(15)
    expect(at('volume', 0.2).robots).toBe(22)
    // Модель прототипа для объёма не описана: наша формула даёт 0,8 / 0,7 года и 175,3 / 260,3 млн ₽ (PRD — 0,8 / 0,6 и 177,3 / 257,7; README).
    expect(at('volume', -0.2).paybackYears).toBeCloseTo(0.8, 1)
  })

  it('покупка: цена робота меняет CAPEX на 20 % статьи «Оборудование»', () => {
    const cheaper = shiftedResult(purchase, economics.current, 5, 'price', -0.2)
    expect(round1(cheaper.capexRub)).toBe(39.3)
    expect(cheaper.opexRubPerYear).toBe(purchase.opexRubPerYear)
  })
})

describe('sensitivity — вывод строки', () => {
  it('RaaS: при +20 % тарифа предпочтение по TCO переходит к покупке, труд и объём его не меняют', () => {
    const rows = sensitivity(raas, [purchase], economics.current, 5)
    expect(rows.map((r) => [r.parameter, r.flipsTo, r.staysPositive])).toEqual([
      ['price', 'purchase', true],
      ['labor', null, true],
      ['volume', null, true],
    ])
  })

  it('покупка: при −20 % цены робота покупка становится дешевле RaaS по TCO', () => {
    expect(sensitivity(purchase, [raas], economics.current, 5)[0]?.flipsTo).toBe('purchase')
  })
})

describe('lowestOf', () => {
  it('единственный минимум — его ключ; ничья или пусто — null', () => {
    expect(lowestOf([{ key: 'a', value: 2 }, { key: 'b', value: 1 }, { key: 'c', value: null }])).toBe('b')
    expect(lowestOf([{ key: 'a', value: 1 }, { key: 'b', value: 1 }])).toBeNull()
    expect(lowestOf<string>([])).toBeNull()
  })
})
