import { describe, expect, it } from 'vitest'
import { NUMERIC_FIELDS, parseConditionField, peaksError, shiftsError, simpleFraction, toFieldText, withCondition, type ConditionBases } from './conditionsModel'

const bases = { growthReserve: { value: 0.1, origin: 'default' } } as unknown as ConditionBases

describe('поля условий (D-102)', () => {
  it('доли показываются и вводятся в процентах', () => {
    expect(toFieldText(NUMERIC_FIELDS.onTimeTarget, 0.95)).toBe('95')
    expect(parseConditionField(NUMERIC_FIELDS.onTimeTarget, '97,5')).toEqual({ ok: true, value: 0.975 })
  })

  it('вне диапазона и пустое поле — текст исправления', () => {
    expect(parseConditionField(NUMERIC_FIELDS.onTimeTarget, '20')).toEqual({ ok: false, error: 'Введите число от 50 до 100' })
    expect(parseConditionField(NUMERIC_FIELDS.shiftsPerDay, '')).toEqual({ ok: false, error: 'Введите число от 1 до 3' })
  })

  it('значение, равное исходному, правкой не считается', () => {
    expect(withCondition({}, bases, 'growthReserve', 0.2)).toEqual({ growthReserve: 0.2 })
    expect(withCondition({ growthReserve: 0.2 }, bases, 'growthReserve', 0.1)).toEqual({})
  })

  it('смены не помещаются в сутки — ошибка', () => {
    expect(shiftsError({ shiftsPerDay: 3, shiftHours: 9 })).toMatch(/не помещаются/)
    expect(shiftsError({ shiftsPerDay: 2, shiftHours: 11 })).toBeNull()
  })

  it('слишком много пиковых часов при коэффициенте — ошибка', () => {
    const all = Array.from({ length: 24 }, (_, h) => h)
    const base = { firstShiftStartHour: 7, shiftsPerDay: 2, shiftHours: 11, peakFactor: 1.5 }
    expect(peaksError({ ...base, peakHours: { inbound: all, outbound: [] } } as never)).toMatch(/не больше 14/)
    expect(peaksError({ ...base, peakHours: { inbound: [8], outbound: [8] } } as never)).toBeNull()
  })

  it('доля в срок — простой дробью: 0,95 → 19 из 20', () => {
    expect(simpleFraction(0.95)).toEqual({ part: 19, whole: 20 })
    expect(simpleFraction(0.9)).toEqual({ part: 9, whole: 10 })
  })
})
