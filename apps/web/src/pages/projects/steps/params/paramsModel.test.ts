import { beforeAll, describe, expect, it } from 'vitest'
import type { LocationProcessId, ProjectParamsSnapshot } from '@/domain'
import { createMockProjects } from '@/services/mock/projects'
import { groupCaption, isNormCode, paramsView, type RowGroup, type ValueRow } from './paramsModel'

let snapshot: ProjectParamsSnapshot

beforeAll(async () => {
  snapshot = await createMockProjects({ latencyMs: 0 }).getParamsSnapshot('PJ-DEMO')
})

const view = (id: LocationProcessId, overrides: Parameters<typeof paramsView>[2] = []) => paramsView(snapshot, id, overrides)
/** Разряды в числах — неразрывный пробел (Intl); в ожиданиях — обычный. */
const plain = <T,>(text: T): T => (typeof text === 'string' ? text.replace(/\u00a0/g, ' ') as T : text)
const value = (groups: readonly RowGroup[], key: string) => {
  const found = groups.flatMap((g) => g.rows).find((r) => r.key === key)
  return found && { ...found, value: plain(found.value) }
}

describe('paramsView — шаг 1 «Параметры проекта» (PRD 11.2)', () => {
  it('перемещение паллет: группы А–Г, нагрузка в пик 130 паллет/ч, производительность от смены 11 ч (№122)', () => {
    const v = view('LP-01')
    expect(v.groups.map((g) => g.key)).toEqual(['object', 'load', 'route', 'workers'])
    expect(value(v.groups, 'operationClass')?.value).toBe('OP-01 · Перемещение грузов')
    expect(value(v.groups, 'mass')?.value).toBe('800 кг / 1 000 кг')
    expect(value(v.groups, 'hours')).toMatchObject({ value: '22 ч · по режиму локации', origin: 'location' })
    expect(value(v.groups, 'peakLoad')).toMatchObject({ value: '2 000 ÷ 22 ч × 1,5 × 95 % = 130 паллет/ч', origin: 'preliminary' })
    expect(value(v.groups, 'productivity')?.value).toBe('7,3 паллет/чел.-ч на исполнителя')
    expect(value(v.groups, 'routeEnds')?.value).toBe('Ворота приёмки 1–6 → Стеллажи A–F')
  })

  it('на демо-локации без данных нагрузка на пол и Wi-Fi: подбор выполним, 4 допущения', () => {
    const v = view('LP-01')
    expect(v.missing.map((m) => m.label)).toEqual(['нагрузка на пол', 'Wi-Fi'])
    expect(v.readiness).toMatchObject({ canMatch: true, assumptionsCount: 4, missingCount: 2, normsCount: 1 })
    expect(v.assumptions.map((a) => [a.code, a.value])).toEqual([
      ['route_length_m', 100], ['operator_time_share_pct', 100], ['peak_factor', 1.5], ['width_margin_m', 0.6],
    ])
  })

  it('инвентаризация: без частоты пересчёта подбор недоступен, нагрузка в пик не рассчитана', () => {
    const v = view('LP-05')
    expect(v.readiness?.canMatch).toBe(false)
    expect(v.readiness?.blocking.map((m) => m.code)).toEqual(['recountsPerMonth'])
    expect(value(v.groups, 'recountsPerMonth')).toMatchObject({ value: null, origin: 'missing', anchor: 'param-recountsPerMonth' })
    expect(value(v.groups, 'peakLoad')?.origin).toBe('missing')
    expect(v.cards.find((c) => c.id === 'LP-05')?.canMatch).toBe(false)
  })

  it('упаковка: свой график 16 ч, маршрут не применяется, нет оклада', () => {
    const v = view('LP-03')
    expect(v.groups.map((g) => g.key)).not.toContain('route')
    expect(value(v.groups, 'hours')?.value).toBe('16 ч · свой график')
    expect(v.readiness?.laborSaving.map((m) => m.code)).toEqual(['salary'])
    expect(v.assumptions.map((a) => a.code)).not.toContain('route_length_m')
    const routeRows = v.siteGroups.flatMap((g) => g.rows).filter((r) => !r.applicable).map((r) => r.key)
    expect(routeRows).toContain('site_aisle_min_m')
  })

  it('уборка: к процессу не привязаны исполнители — экономия труда не рассчитается', () => {
    const v = view('LP-04')
    expect(v.readiness?.laborSaving.map((m) => m.code)).toEqual(['workers'])
    expect(v.assumptions.map((a) => a.code)).not.toContain('operator_time_share_pct')
  })

  it('25 параметров площадки в 5 группах; «нет данных» — ссылка в профиль, температура — одной строкой', () => {
    const rows = view('LP-01').siteGroups.flatMap((g) => g.rows)
    expect(rows).toHaveLength(25)
    expect(rows.find((r) => r.key === 'site_floor_load_tm2')).toMatchObject({ value: null, origin: 'missing' })
    expect(plain(rows.find((r) => r.key === 'site_temp_min_c')?.value)).toBe('от +5 до +25 °C')
    expect(rows.find((r) => r.key === 'wh_main_aisle_width')).toMatchObject({ value: '3,5 м', origin: 'file' })
  })

  it('уточнение: факт убирает значение из допущений, оценка оставляет допущением с новым числом', () => {
    const fact = view('LP-01', [{ code: 'peak_factor', value: 1.8, kind: 'fact' }])
    expect(fact.readiness?.assumptionsCount).toBe(3)
    expect(value(fact.groups, 'peak')).toMatchObject({ value: '1,8', origin: 'specified' })
    expect(value(fact.groups, 'peakLoad')?.value).toContain('× 1,8 ×')
    const estimate = view('LP-01', [{ code: 'route_length_m', value: 120, kind: 'estimate' }])
    expect(estimate.readiness?.assumptionsCount).toBe(4)
    expect(value(estimate.groups, 'routeLength')).toMatchObject({ value: '120 м', origin: 'assumption' })
  })

  it('процесс не выбран — групп и готовности нет', () => {
    const v = paramsView(snapshot, null, [])
    expect(v.selected).toBeNull()
    expect(v.readiness).toBeNull()
    expect(v.cards).toHaveLength(5)
  })
})

describe('доска 16325: строка процесса, подписи групп, счётчики', () => {
  it('объём — число и единица отдельно, как в колонке «Объём»', () => {
    const card = view('LP-01').cards.find((c) => c.id === 'LP-01')
    expect(card).toMatchObject({ operationClass: 'OP-01', volumeUnit: 'паллет/сутки' })
    expect(plain(card?.volumeValue)).toBe('2 000')
  })

  it('подпись группы считает параметры, допущения и «нет данных»', () => {
    const rows: readonly ValueRow[] = [
      { key: 'a', label: 'А', value: '1', origin: 'specified' },
      { key: 'b', label: 'Б', value: '2', origin: 'assumption' },
      { key: 'c', label: 'В', value: null, origin: 'missing' },
    ]
    expect(plain(groupCaption(rows))).toBe('3 параметра · 1 по допущению · 1 нет данных')
    expect(plain(groupCaption(rows.slice(0, 1)))).toBe('1 параметр')
  })

  it('упаковка (1.3): свой график, маршрут не применяется, оклад — с группой персонала', () => {
    const v = view('LP-03')
    expect(v.ownScheduleHours).toBe(16)
    expect(v.routeApplies).toBe(false)
    expect(v.missing.find((m) => m.code === 'salary')?.label).toBe('оклад · Операторы упаковочных линий')
    expect(v.readiness?.canMatch).toBe(true)
  })

  it('комплектация (1.2): режим локации, маршрут есть, подбор выполним', () => {
    const v = view('LP-02')
    expect(v.ownScheduleHours).toBeNull()
    expect(v.routeApplies).toBe(true)
    expect(v.readiness?.canMatch).toBe(true)
  })

  it('«Допущения» и «Нормативы» в rail совпадают с типами строк таблицы', () => {
    const v = view('LP-01')
    const norms = v.assumptions.filter((a) => isNormCode(a.code)).length
    expect(v.readiness?.normsCount).toBe(norms)
    expect((v.readiness?.assumptionsCount ?? 0) - (v.readiness?.normsCount ?? 0)).toBe(v.assumptions.length - norms)
  })
})
