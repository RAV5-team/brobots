import { describe, expect, it } from 'vitest'
import { toEconomics } from '@/api/mappers/economics'
import { DEFAULT_MODEL_NORMS, type ScenarioEconomics, type SimulationRun } from '@/domain'
import { CONDITIONS_LP01 } from '@/mocks/fixtures/projectEconomics'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { toCsv } from '@/shared/dom/download'
import { hourlyCsv, tablesCsv } from './economicsCsv'
import { cashFlowMillions, chainRows, scenarioRows, sensitivityView } from './economicsTables'
import { conclusionView, conditionsFor, money, parseAcquisition, shownScenario, tiles } from './economicsView'

const economics = toEconomics(EVALUATION_LP01, 'RB-0008', { conditions: CONDITIONS_LP01, operationsPerDay: 2000 })
const scenario = (acq: 'raas' | 'purchase'): ScenarioEconomics => {
  const found = economics.scenarios.find((s) => s.acquisition === acq)
  if (!found) throw new Error(acq)
  return found
}
const run = { id: 'SIM-X', before: { peak: { requiredPerHour: 130, servedPerHour: 122 } } } as unknown as SimulationRun

describe('conclusionView (PRD 11.5)', () => {
  it('без симуляции — «при условиях» и следующий шаг «Запустить симуляцию…»', () => {
    const view = conclusionView(scenario('raas'), CONDITIONS_LP01, 'none', null)
    expect(view).toMatchObject({ kind: 'conditional', nextStep: 'Запустить симуляцию, затем обследование объекта' })
  })

  it('все условия подтверждены и прогон пройден — «Предварительно целесообразно», шаг «Рассмотреть пилот»', () => {
    const confirmed = CONDITIONS_LP01.map((c) => ({ ...c, status: 'confirmed' as const }))
    expect(conclusionView(scenario('raas'), confirmed, 'passed', null)).toMatchObject({ kind: 'preliminary', nextStep: 'Рассмотреть пилот' })
  })

  it('с риском — дефицит из итогов проверенного состава (№118): 122 из 130, дефицит 8', () => {
    const view = conclusionView(scenario('raas'), CONDITIONS_LP01, 'risk_accepted', run)
    expect(view.kind).toBe('not_recommended')
    expect(view.explanation).toBe('В модели достигнуто 122 из 130 рейсов/ч — дефицит 8 рейсов/ч')
  })

  it('эффект не положителен — «Не рекомендуется», шаг — пересмотреть модель приобретения', () => {
    const view = conclusionView({ ...scenario('raas'), annualEffectRub: -1_000_000 }, CONDITIONS_LP01, 'passed', null)
    expect(view).toMatchObject({ kind: 'not_recommended', nextStep: 'Пересмотреть модель приобретения или вернуться к симуляции' })
  })
})

describe('экранные данные итога', () => {
  it('тариф RaaS в реестре только у RaaS; адрес сценария — только purchase и raas', () => {
    expect(conditionsFor(CONDITIONS_LP01, 'purchase').map((c) => c.parameter)).not.toContain('Тариф RaaS')
    expect(conditionsFor(CONDITIONS_LP01, 'raas')).toHaveLength(7)
    expect(parseAcquisition('purchase')).toBe('purchase')
    expect(parseAcquisition('lease')).toBeNull()
  })

  it('суммы: миллионы с одним знаком, меньше миллиона — тысячи', () => {
    expect(money(42_000_000)).toMatch(/^42,0\sмлн\s₽$/u)
    expect(money(400_000)).toMatch(/^400\sтыс\.\s₽$/u)
    expect(money(null)).toBe('—')
  })

  it('у сохранённой оценки выбранный сценарий показывает снимок A1 (D-81)', () => {
    const pj06 = PROJECTS.find((p) => p.id === 'PJ-06')
    if (!pj06) throw new Error('PJ-06')
    const drifted = { ...economics, scenarios: economics.scenarios.map((s) => (s.acquisition === 'purchase' ? { ...s, capexRub: 1 } : s)) }
    expect(shownScenario(drifted, pj06, 'purchase')?.capexRub).toBe(47_400_000)
    expect(shownScenario(drifted, pj06, 'raas')?.capexRub).toBe(6_100_000)
  })

  it('плитки покупки: вторая — новые расходы 2,8 млн ₽ вместо платежа RaaS', () => {
    const [, second] = tiles(scenario('purchase'), economics)
    expect(second?.label).toBe('Новые расходы в год')
    expect(second?.value).toMatch(/^2,8\sмлн/u)
  })

  it('сравнение: 14 строк PRD, снижение OPEX RaaS 9,2 млн ₽ · 18 %, ставки ≈ 9 при окладе 120 000', () => {
    const facts = { staff: { role: 'Операторы', headcount: 25, salaryRub: 120_000, timeShare: 1 } } as never
    const rows = scenarioRows({ norms: DEFAULT_MODEL_NORMS, economics, scenarios: economics.scenarios, facts, run: null, conditions: CONDITIONS_LP01 })
    expect(rows).toHaveLength(14)
    expect(rows.find((r) => r.key === 'reduction')?.values.raas).toMatch(/^9,2\sмлн\s₽ · 18\s%$/u)
    expect(rows.find((r) => r.key === 'labor')?.values.raas).toMatch(/≈ 9\sставок$/u)
    expect(rows.find((r) => r.key === 'check')?.values.raas).toBe('только расчёт')
    expect(rows.find((r) => r.key === 'tco')?.mark).toEqual({ column: 'raas', text: 'Меньше TCO' })
  })

  it('цепочка и поток: 51,2 → 42,0, поток −6,1 … +39,9', () => {
    const chain = chainRows(scenario('raas'), economics, null, [], DEFAULT_MODEL_NORMS)
    expect(chain.map((r) => r.amount).join(' ')).toMatch(/51,2.*− 16,7.*− 2,8.*\+ 10,3.*42,0.*9,2/su)
    expect(cashFlowMillions(scenario('raas'), 5)).toEqual([-6.1, 3.1, 12.3, 21.5, 30.7, 39.9])
  })

  it('устойчивость: сверху — самый влиятельный параметр, у тарифа — смена предпочтения на покупку', () => {
    const rows = sensitivityView(scenario('raas'), [scenario('purchase')], economics, null, DEFAULT_MODEL_NORMS)
    expect(rows[0]?.key).toBe('labor')
    expect(rows.find((r) => r.key === 'price')).toMatchObject({ label: 'Тариф RaaS', conclusion: 'Предпочтение по TCO меняется на покупку' })
  })

  it('CSV: секции сценариев, статей и условий; по часам — строка на час', () => {
    const rows = scenarioRows({ norms: DEFAULT_MODEL_NORMS, economics, scenarios: economics.scenarios, facts: null, run: null, conditions: CONDITIONS_LP01 })
    const csv = tablesCsv([{ key: 'current', label: 'Текущий' }, { key: 'raas', label: 'RaaS' }], rows, scenario('raas'), CONDITIONS_LP01)
    expect(csv[0]).toEqual(['Сценарии'])
    expect(csv.some((row) => row[0] === 'Состав CAPEX и OPEX')).toBe(true)
    expect(toCsv([['a;b', 'c"d']])).toBe('﻿"a;b";"c""d"')
    const hour = { hour: 7, demand: 130, done: 130, onTime: 0.98, waitMeanMin: null, working: 10, charging: 1, waitingCharger: 0, down: 0, idle: 7, utilization: 0.8, backlogMax: 0, chargersBusy: 0.5 }
    expect(hourlyCsv([hour])[1]?.slice(0, 4)).toEqual(['07', '130', '130', '98'])
  })
})
