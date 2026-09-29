import { describe, expect, it } from 'vitest'
import { toMatchingEvaluation } from '@/api/mappers/matching'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { CALC_DEFAULTS_LP01, EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { robotCharacteristics } from '@/pages/catalog/characteristics'
import { withVariantDetails } from '@/services/mock/variantDetails'
import { detailsVariant, overviewView, parseDetailsKey } from './variantDetailsModel'

const evaluation = withVariantDetails(toMatchingEvaluation(EVALUATION_LP01, CALC_DEFAULTS_LP01), 'LP-01')
const amr = ROBOTS.find((r) => r.id === 'RB-0008')
if (!amr) throw new Error('AMR 800')
const map = robotCharacteristics(amr, { operationClasses: OPERATION_CLASSES, processes: PROCESSES, facilityTypes: FACILITY_TYPES, catalogVersion: 'v4' })

describe('окно 2.1а: вариант из адреса', () => {
  it('ключ «решение:способ»; чужое — null', () => {
    expect(parseDetailsKey('RB-0008:raas')).toEqual({ solutionId: 'RB-0008', acquisition: 'raas' })
    expect(parseDetailsKey('RB-0008:lease')).toBeNull()
    expect(parseDetailsKey(null)).toBeNull()
  })

  it('открывается только вариант рейтинга', () => {
    expect(detailsVariant(evaluation, 'RB-0008:purchase')?.rank).toBe(4)
    expect(detailsVariant(evaluation, 'RB-0004:raas')).toBeNull()
  })
})

describe('вкладка «Обзор» (16666:10)', () => {
  const v = detailsVariant(evaluation, 'RB-0008:raas')
  if (!v) throw new Error('AMR 800 · RaaS')
  const view = overviewView(v, amr, map, ['нагрузка на пол', 'Wi-Fi'])

  it('идентификация и применимость — значения строк К-4; наименование — предложение расчёта, производитель — бренд', () => {
    const value = (key: string) => view.identification.find((r) => r.key === key)?.value
    expect(value('name')).toBe('AMR 800 · базовая комплектация')
    expect(value('manufacturer')).toBe('Морос')
    expect(value('solutionType')).toBe(map.solutionType.value)
    expect(value('purpose')).toBe('Перемещение паллет и тележек с подъёмом платформой')
    expect(view.applicability.map((r) => [r.key, r.value])).toEqual(
      (['supportedProcesses', 'facilityTypes', 'limitations', 'cases'] as const).map((key) => [key, map[key].value]),
    )
  })

  it('почему подходит, недостающие данные (D-99) и 8 вкладов в порядке макета', () => {
    expect(view.fits).toHaveLength(3)
    expect(view.missing).toEqual(['Нагрузка на пол', 'Wi-Fi'])
    expect(view.criteria.map((r) => r.key).slice(0, 4)).toEqual(['payback', 'roi', 'budget_fit', 'tco_savings'])
    expect(view.criteria[0]).toEqual({ key: 'payback', label: 'окупаемость', value: '0,30' })
  })
})
