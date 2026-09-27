import { describe, expect, it } from 'vitest'
import { deriveLaunchRequired, launchCostRub, type LaunchItem } from './catalogItem'

const item = (overrides: Partial<LaunchItem>): LaunchItem => ({
  id: 'SI-INF-99',
  type: 'infrastructure',
  name: 'Позиция',
  supplier: 'Поставщик',
  specs: [],
  price: { kind: 'rub', amountRub: 1 },
  costType: 'capex',
  quantityNorm: '1 на объект',
  compatibleWith: [],
  source: 'тест',
  ...overrides,
})

const COMMISSIONING = item({ id: 'SI-SRV-02', type: 'service', launchCategory: 'commissioning', compatibleWith: [{ kind: 'text', text: 'Все конфигурации' }] })

describe('deriveLaunchRequired (D-63, D-78)', () => {
  it('always requires the commissioning item, even with no compatible items', () => {
    expect(deriveLaunchRequired('RB-0001', [COMMISSIONING])).toEqual(['SI-SRV-02'])
  })

  it('adds the charging and fleet items that name the robot by id, in card order', () => {
    const items = [
      item({ id: 'SI-SW-01', launchCategory: 'fleet', compatibleWith: [{ kind: 'robot', id: 'RB-0001' }] }),
      item({ id: 'SI-INF-01', launchCategory: 'charging', compatibleWith: [{ kind: 'robot', id: 'RB-0001' }] }),
      item({ id: 'SI-INF-02', launchCategory: 'charging', compatibleWith: [{ kind: 'robot', id: 'RB-0002' }] }),
      COMMISSIONING,
    ]
    expect(deriveLaunchRequired('RB-0001', items)).toEqual(['SI-INF-01', 'SI-SW-01', 'SI-SRV-02'])
    expect(deriveLaunchRequired('RB-0002', items)).toEqual(['SI-INF-02', 'SI-SRV-02'])
  })

  it('ignores group compatibility written as text and items that depend on the site', () => {
    const items = [
      item({ launchCategory: 'charging', compatibleWith: [{ kind: 'text', text: 'Все наземные роботы' }] }),
      item({ id: 'SI-SW-02', launchCategory: 'wms', compatibleWith: [{ kind: 'robot', id: 'RB-0001' }] }),
      COMMISSIONING,
    ]
    expect(deriveLaunchRequired('RB-0001', items)).toEqual(['SI-SRV-02'])
  })
})

describe('launchCostRub (D-78)', () => {
  it('sums the rouble prices of the chosen items and skips prices in percent of CAPEX', () => {
    const items = [
      item({ id: 'SI-INF-04', price: { kind: 'rub', amountRub: 250_000 } }),
      item({ id: 'SI-SW-01', price: { kind: 'rub', amountRub: 1_100_000 } }),
      item({ id: 'SI-SUP-01', price: { kind: 'percent-of-capex', percent: 10 } }),
    ]
    expect(launchCostRub(['SI-INF-04', 'SI-SW-01', 'SI-SUP-01', 'SI-XX-99'], items)).toBe(1_350_000)
  })
})
