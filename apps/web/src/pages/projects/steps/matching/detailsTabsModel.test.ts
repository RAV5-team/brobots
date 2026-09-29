import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { needsCheckCount, siteFactsOf, siteRequirementChecks } from '@/domain'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { NORMS } from '@/mocks/fixtures/norms'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { SITE_VALUES } from '@/mocks/fixtures/siteParameters'
import { robotCharacteristics } from '@/pages/catalog/characteristics'
import { withVariantDetails } from '@/services/mock/variantDetails'
import { dataQualityView, formatSiteValue, infrastructureView, technicalView } from './detailsTabsModel'
import { findVariant } from './matchingModel'

const evaluation = withVariantDetails(toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01), 'LP-01')
const amr = ROBOTS.find((r) => r.id === 'RB-0008')
const himki = LOCATIONS.find((l) => l.id === 'LOC-01')
const margin = NORMS.find((n) => n.code === 'width_margin_m')?.value
const v = findVariant(evaluation, 'RB-0008', 'raas')
if (!amr || !himki || typeof margin !== 'number' || !v) throw new Error('фикстуры AMR 800 и РЦ Химки')
const map = robotCharacteristics(amr, { operationClasses: OPERATION_CLASSES, processes: PROCESSES, facilityTypes: FACILITY_TYPES, catalogVersion: 'v4' })
const site = siteFactsOf(himki, SITE_VALUES['LOC-01'] ?? {})

describe('вкладка «Технические» (16830:10)', () => {
  const tech = technicalView(v, amr, map, false)

  it('11 строк; значения, источники и статусы — характеристик К-4', () => {
    expect(tech.rows).toHaveLength(11)
    const payload = tech.rows.find((r) => r.key === 'payload')
    expect(payload).toMatchObject({ value: map.payload.value, source: map.payload.source, verification: 'confirmed' })
  })

  it('нет данных — «нет данных» без плашки, как на К-4; эффективная — оценка расчёта; симуляция — ещё не проверено', () => {
    expect(tech.rows.find((r) => r.key === 'productivity')).toEqual({ key: 'productivity', label: 'Производительность по каталогу', value: null })
    expect(tech.rows.find((r) => r.key === 'effective')).toMatchObject({ value: '8,6 рейса/ч', verification: 'estimate' })
    expect(tech.rows.find((r) => r.key === 'simulation')).toMatchObject({ verification: 'pending', source: 'Симуляция ещё не выполнена' })
  })
})

describe('вкладка «Инфраструктура» (16832:10)', () => {
  const infra = infrastructureView(v, amr, map, site, margin)

  it('«требует проверки» — то же правило площадки, что счётчик 2.1б и «Недостающие данные» (D-99)', () => {
    const open = infra.checks.filter((r) => r.verification === 'needsCheck').length
    expect(open).toBe(needsCheckCount(siteRequirementChecks(amr.specs, site, margin)))
    expect(open).toBe(2)
  })

  it('вспомогательное оборудование — результат расчёта: 6 станций, 18 адаптеров, 4 точки Wi-Fi', () => {
    expect(infra.equipment.map((r) => r.value)).toEqual(['6', '18', '4'])
  })

  it('открытый диапазон температуры — «от» / «до»', () => {
    expect(formatSiteValue({ kind: 'range', min: 5, max: null, unit: 'celsius' })).toBe('от +5 °C')
    expect(formatSiteValue({ kind: 'range', min: 5, max: 25, unit: 'celsius' })).toBe('+5…+25 °C')
  })
})

describe('вкладка «Качество данных» (16832:1463)', () => {
  it('источник и дата — К-4; подтверждённость — оценки «Технических» и открытые требования площадки', () => {
    const tech = technicalView(v, amr, map, false)
    const infra = infrastructureView(v, amr, map, site, margin)
    const rows = dataQualityView(map, tech, infra).rows
    expect(rows.find((r) => r.key === 'source')?.value).toBe(map.dataSource.value)
    expect(rows.find((r) => r.key === 'confirmedness')?.value).toBe('2\u00a0значения оценкой · 2\u00a0требования площадки без проверки')
  })
})
