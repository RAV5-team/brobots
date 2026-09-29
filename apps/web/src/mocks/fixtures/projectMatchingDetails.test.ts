import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { needsCheckCount, siteFactsOf, siteRequirementChecks, type RankedVariant } from '@/domain'
import { withVariantDetails } from '@/services/mock/variantDetails'
import { LOCATIONS } from './locations'
import { NORMS } from './norms'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from './projectMatching'
import { VARIANT_DETAILS_LP01, variantKey } from './projectMatchingDetails'
import { ROBOTS } from './robots'
import { SITE_VALUES } from './siteParameters'

const base = toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01)
const evaluation = withVariantDetails(base, 'LP-01')
const variant = (solutionId: string, acquisition: RankedVariant['acquisition']): RankedVariant => {
  const found = evaluation.variants.find((v) => v.solutionId === solutionId && v.acquisition === acquisition)
  if (!found) throw new Error(`нет варианта ${solutionId} · ${acquisition}`)
  return found
}
const sum = (values: readonly number[]): number => values.reduce((acc, v) => acc + v, 0)
const AMR800 = [variant('RB-0008', 'raas'), variant('RB-0008', 'purchase')]

describe('поля окна 2.1а (projectMatchingDetails.ts)', () => {
  it('каждая запись — вариант рейтинга LP-01, у каждого варианта есть разбор балла', () => {
    const keys = new Set(base.variants.map((v) => variantKey(v.solutionId, v.acquisition)))
    expect(Object.keys(VARIANT_DETAILS_LP01).filter((key) => !keys.has(key))).toEqual([])
    expect(evaluation.variants.filter((v) => v.criteria.some((c) => c.contribution === null))).toEqual([])
  })

  it('сумма вкладов равна баллу фикстуры у всех 8 вариантов (D-13, PRD 15 · №20)', () => {
    for (const v of evaluation.variants) {
      const contributions = v.criteria.map((c) => c.contribution ?? Number.NaN)
      expect(sum(contributions), `${v.solutionName} · ${v.acquisition}`).toBeCloseTo(v.score ?? Number.NaN, 5)
    }
  })

  it('разбор — те же 8 критериев, веса и порядок, что в ответе API; у AMR 800 · RaaS совпадает с ответом API', () => {
    const fromApi = base.variants.find((v) => v.solutionId === 'RB-0008' && v.acquisition === 'raas')
    expect(variant('RB-0008', 'raas').criteria).toEqual(fromApi?.criteria)
    for (const v of evaluation.variants) {
      expect(v.criteria.map((c) => [c.code, c.weight])).toEqual(fromApi?.criteria.map((c) => [c.code, c.weight]))
      expect(v.criteria.every((c) => c.contribution !== null && c.contribution >= 0)).toBe(true)
    }
  })

  it('цена, условия, оборудование — только у AMR 800; у остальных экран покажет «нет данных»', () => {
    const others = evaluation.variants.filter((v) => v.solutionId !== 'RB-0008')
    for (const key of ['priceOffer', 'raasTerms', 'auxEquipment', 'ownership', 'netEffectItems', 'fits', 'effectiveProductivity'] as const) {
      expect(others.filter((v) => key in v).map((v) => v.solutionName), key).toEqual([])
      expect(AMR800[1]?.[key] !== undefined || key === 'raasTerms', key).toBe(true)
    }
    expect(variant('RB-0008', 'purchase')).not.toHaveProperty('raasTerms')
  })

  it('чистый эффект по статьям сходится с эффектом варианта, новые расходы — статьи OPEX роботов', () => {
    const baselineOnly = new Set(['labor.remaining_annual_payroll', 'opex.annual_repair_cost'])
    for (const v of AMR800) {
      const items = v.netEffectItems ?? []
      expect(sum(items.map((i) => i.amountRub))).toBeCloseTo(v.annualEffectRub, -3)
      const newCosts = sum(v.opexItems.filter((i) => !baselineOnly.has(i.code)).map((i) => i.amountRub))
      expect(items.find((i) => i.kind === 'new_costs')?.amountRub).toBeCloseTo(-newCosts, -3)
      expect(items.find((i) => i.kind === 'labor')?.amountRub).toBe(v.laborSavingsRubPerYear)
    }
  })

  it('условия RaaS: платёж за парк — как в рейтинге, ставка × роботов с точностью до рубля на робота', () => {
    const raas = variant('RB-0008', 'raas')
    const terms = raas.raasTerms
    expect(terms?.monthlyFleetRub).toBe(raas.raasMonthlyRub)
    expect(Math.abs((terms?.rateRub ?? 0) * raas.robots - (terms?.monthlyFleetRub ?? 0))).toBeLessThan(raas.robots)
  })

  it('цена единицы — из «Параметров расчёта» (№107); ПО и обслуживание покупки — статьи CAPEX и OPEX', () => {
    const purchase = variant('RB-0008', 'purchase')
    expect(AMR800.map((v) => v.priceOffer?.unitPriceRub)).toEqual([CALC_DEFAULTS_LP01.robotPriceRub, CALC_DEFAULTS_LP01.robotPriceRub])
    expect(purchase.ownership?.softwareOneOffRub).toBe(purchase.capexItems.find((i) => i.code === 'capex.software')?.amountRub)
    expect(purchase.ownership?.softwareRubPerYear).toBe(purchase.opexItems.find((i) => i.code === 'opex.annual_license_cost')?.amountRub)
    expect(purchase.ownership?.serviceRubPerYear).toBe(purchase.opexItems.find((i) => i.code === 'opex.annual_service_cost')?.amountRub)
    expect(purchase.ownership?.implementationRub?.value).toBe(purchase.capexItems.find((i) => i.code === 'capex.commissioning')?.amountRub)
  })

  it('оборудование и производительность сходятся с расчётом: станции, адаптер на робота, 3 600 ÷ цикл × загрузка', () => {
    const amr = ROBOTS.find((r) => r.id === 'RB-0008')
    for (const v of AMR800) {
      expect(v.auxEquipment).toMatchObject({ stations: v.stations, adapters: v.robots })
      const p = v.effectiveProductivity
      expect(p?.cycleTimeS).toBe(v.cycleTimeS)
      expect(p?.loadTimeS).toBe(amr?.specs.loadTimeS)
      expect((3600 / (p?.cycleTimeS ?? 1)) * (p?.utilization ?? 0)).toBeCloseTo(p?.tripsPerHour ?? 0, 0)
    }
  })

  it('«Недостающие данные» — те же параметры площадки, что «требует проверки» правила площадки (D-99)', () => {
    const himki = LOCATIONS.find((l) => l.id === 'LOC-01')
    const amr = ROBOTS.find((r) => r.id === 'RB-0008')
    const margin = NORMS.find((n) => n.code === 'width_margin_m')?.value
    if (!himki || !amr || typeof margin !== 'number') throw new Error('нет РЦ Химки, AMR 800 или норматива')
    const checks = siteRequirementChecks(amr.specs, siteFactsOf(himki, SITE_VALUES['LOC-01'] ?? {}), margin)
    // Недостающие данные не хранятся в варианте: их 2 — нагрузка на пол и Wi-Fi, как в правой колонке 2.1.
    expect(needsCheckCount(checks)).toBe(2)
    for (const v of AMR800) expect(v.fits?.every((c) => c.status === 'pass')).toBe(true)
    expect(checks.filter((c) => c.status === 'misfit')).toEqual([])
  })

  it('у AMR 800 есть собственная масса и «Назначение»', () => {
    const amr = ROBOTS.find((r) => r.id === 'RB-0008')
    expect(amr?.specs.massKg).toBe(150)
    expect(amr?.purpose).toBe('Перемещение паллет и тележек с подъёмом платформой')
  })
})
