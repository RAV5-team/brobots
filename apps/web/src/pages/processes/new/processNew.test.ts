import { describe, expect, it } from 'vitest'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESS_DEMO_TEXT, PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { staffTotals, toNewProcess, validateForm, volumeRates } from './processCalc'
import { buildInitialForm, warehouseBase } from './processDemoForm'
import { countFormulas, countRequired, isProcessForm, parseDecimal, toggleHandling, updateStaffRow, type ProcessForm } from './processForm'
import { carrierOptions, numericHints, templateCheck } from './processNewModel'
import { staffStats, volumeStats } from './processStats'

const WAREHOUSE = FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse')
const demo = (): ProcessForm => buildInitialForm(WAREHOUSE, { ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: 0.6 }, PROCESS_DEMO_TEXT)
const nbsp = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

describe('parseDecimal', () => {
  it.each([
    ['2 000', 2000],
    ['2 000', 2000],
    ['1,5', 1.5],
    ['0.8', 0.8],
    ['-25', -25],
  ])('parses %s', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected)
  })

  it.each(['', '  ', 'abc', '1,5,5', '1e3'])('rejects %j', (raw) => {
    expect(parseDecimal(raw)).toBeNull()
  })
})

describe('demo form (экран 09а, значения демо-склада)', () => {
  it('takes dataset values and formulas from warehouse parameters', () => {
    const form = demo()
    expect([form.unitMassKg, form.dailyVolume, form.workHours, form.peakFactor, form.automationPct, form.routeLengthM].map(nbsp))
      .toEqual(['800', '2 000', '22', '1,5', '95', '100'])
    expect([form.minAisleWidthM, form.workTimeLossPct, nbsp(form.fleetSalaryRub)]).toEqual(['2,8', '25', '120 000'])
    expect(form.handling).toEqual(['forks', 'platform'])
    expect([form.replacement.forks, form.replacement.platform]).toEqual(['0,80', '0,60'])
  })

  it('selects forklift operators with 100 % and keeps the missing packer salary', () => {
    expect(demo().staff.map((r) => [r.role, r.headcount, r.salaryRub, r.selected])).toEqual([
      ['Операторы погрузчиков', 25, 120000, true],
      ['Отборщики (комплектовщики)', 100, 100000, false],
      ['Операторы упаковочных линий', 20, null, false],
    ])
  })

  it('fails loudly when a dataset parameter is missing', () => {
    expect(() => warehouseBase([])).toThrow(/wh_inbound_pallets/)
  })
})

describe('volume and staff formulas (PRD 9.2)', () => {
  it('computes peak, to-robots and average rates on unrounded values', () => {
    const rates = volumeRates(demo())
    expect(rates?.peak).toBeCloseTo(136.36, 2)
    expect(rates?.toRobots).toBeCloseTo(129.55, 2)
    expect(rates?.average).toBeCloseTo(86.36, 2)
  })

  it('rounds half away from zero for display — 130, not 129 (PRD 15 · №36, D-19)', () => {
    expect(volumeStats(demo()).map((s) => [nbsp(s.value as string), nbsp(s.formula)])).toEqual([
      ['136 оп./ч', '= 2 000 ÷ 22 × 1,5'],
      ['130 рейсов/ч', '= 136 × 0,95'],
      ['86 оп./ч', '= 2 000 × 0,95 ÷ 22'],
    ])
  })

  it('returns no rates when hours are missing', () => {
    expect(volumeRates({ ...demo(), workHours: '' })).toBeNull()
  })

  it('computes FTE and payroll as on the layout', () => {
    const totals = staffTotals(demo(), 1.302)
    expect(totals?.fte).toBeCloseTo(23.75, 5)
    expect(totals?.baseFot).toBeCloseTo(46_872_000, 0)
    expect(totals?.targetFot).toBeCloseTo(44_528_400, 0)
    expect(staffStats(demo(), 1.302).map((s) => nbsp(s.value as string))).toEqual(['23,75', '46,9 млн ₽/год', '44,5 млн ₽/год'])
  })

  it('sums several groups and switches formulas to a sum caption', () => {
    const form = updateStaffRow(demo(), 'Отборщики (комплектовщики)', { selected: true, timeSharePct: '50' })
    const totals = staffTotals(form, 1.302)
    expect(totals?.fte).toBeCloseTo(23.75 + 100 * 0.5 * 0.95, 5)
    expect(staffStats(form, 1.302)[0]?.formula).toBe('сумма по выбранным группам')
  })

  it('asks to choose a group when nothing is selected', () => {
    const form = updateStaffRow(demo(), 'Операторы погрузчиков', { selected: false })
    expect(staffTotals(form, 1.302)).toBeNull()
    expect(staffStats(form, 1.302)).toHaveLength(1)
  })
})

describe('template check rail', () => {
  it('counts 12 required fields including two table columns and 3 formulas (PRD 15 · №35)', () => {
    expect(countRequired()).toBe(12)
    expect(countFormulas()).toBe(3)
  })

  it('counts warehouse locations and robots of the class from fixtures', () => {
    const check = templateCheck(demo(), { 'OP-01': 16 }, LOCATIONS)
    expect(check).toEqual({ formulas: 3, required: 12, robots: 16, locations: LOCATIONS.filter((l) => l.facilityType === 'warehouse').length })
  })
})

describe('validateForm', () => {
  it('accepts the demo form', () => {
    expect(validateForm(demo())).toEqual({})
  })

  it('reports required, number, range, handling and staff problems with a way to fix them', () => {
    let form = { ...demo(), name: ' ', dailyVolume: 'много', peakFactor: '0,5' }
    form = toggleHandling(toggleHandling(form, 'forks'), 'platform')
    form = updateStaffRow(form, 'Операторы упаковочных линий', { selected: true, timeSharePct: '120' })
    const errors = validateForm(form)
    expect(errors.name).toBe('Заполните поле')
    expect(errors.dailyVolume).toBe('Введите число: например, 1,5')
    expect(errors.peakFactor).toMatch(/^Допустимо от 1 до 10$/)
    expect(errors.handling).toMatch(/хотя бы один способ/)
    expect(errors.staff).toMatch(/«Операторы упаковочных линий» не указан оклад/)
    expect(errors['staff:Операторы упаковочных линий']).toMatch(/от 1 до 100/)
  })

  it('checks replacement ratios of selected methods only', () => {
    const form = { ...demo(), replacement: { ...demo().replacement, forks: '1,4', tow: 'x' } }
    expect(Object.keys(validateForm(form))).toEqual(['replacement:forks'])
  })
})

describe('toNewProcess', () => {
  it('maps the form to a library process with shares in 0…1', () => {
    const process = toNewProcess(demo(), 'ед. груза', 'Паллеты между зонами')
    expect(process).toMatchObject({
      name: 'Перемещение паллет · кросс-докинг',
      operationClass: 'OP-01',
      facilityTypes: ['warehouse'],
      handling: [{ method: 'forks', laborReplacementRatio: 0.8 }, { method: 'platform', laborReplacementRatio: 0.6 }],
      defaultWorkerRole: 'Операторы погрузчиков',
      defaults: { unitMassKg: 800, dailyVolume: 2000, workHoursPerDay: 22, automationShare: 0.95, routeLengthM: 100, minOperatingTempC: 5 },
    })
    expect(process.template).toMatchObject({ peakFactor: 1.5, indoor: true, staff: [{ role: 'Операторы погрузчиков', timeShare: 1 }], sitePreparationShare: 0.05, itIntegrationRub: 2_000_000 })
  })
})

describe('form options and hints', () => {
  it('offers carriers of the same class without duplicates, current value first', () => {
    const labels = carrierOptions(PROCESSES, OPERATION_CLASSES, demo()).map((o) => o.label)
    expect(labels[0]).toBe('Паллета на полу')
    expect(labels).toContain('Багажная тележка')
    expect(new Set(labels.map((l) => l.toLowerCase())).size).toBe(labels.length)
  })

  it('builds formula hints from the dataset', () => {
    const hints = numericHints(warehouseBase(WAREHOUSE), demo())
    expect(nbsp(hints.workHours ?? '')).toBe('= 2 смены × 11 ч (из локации)')
    expect(nbsp(hints.routeLengthM ?? '')).toBe('= √ активной зоны 10 000 м². Уточнится на 2D-схеме при симуляции')
    expect(nbsp(hints.liftTripPct ?? '')).toBe('1 этаж — лифты не нужны')
  })
})

describe('начальная форма без демо-режима (аудит 2026-09-28, §6)', () => {
  it('тексты примера пустые, значения датасета и по умолчанию — те же', () => {
    const plain = buildInitialForm(WAREHOUSE, { ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: 0.6 }, null)
    expect([plain.name, plain.carrier, plain.route]).toEqual(['', '', ''])
    expect({ ...plain, name: '', carrier: '', route: '' }).toEqual({ ...demo(), name: '', carrier: '', route: '' })
  })
})

describe('isProcessForm (черновик из браузера, D-21)', () => {
  it('accepts a saved form', () => {
    expect(isProcessForm(JSON.parse(JSON.stringify(demo())))).toBe(true)
  })

  it('rejects drafts of another form version', () => {
    const form = demo()
    expect(isProcessForm({ name: 'x' })).toBe(false)
    expect(isProcessForm(null)).toBe(false)
    expect(isProcessForm({ ...form, staff: [{ role: 'Отборщики' }] })).toBe(false)
    expect(isProcessForm({ ...form, handling: ['forks', 'wings'] })).toBe(false)
    expect(isProcessForm({ ...form, replacement: { forks: 0.8 } })).toBe(false)
    expect(isProcessForm({ ...form, operationClass: 'Перемещение' })).toBe(false)
    expect(isProcessForm({ ...form, dailyVolume: undefined })).toBe(false)
  })
})
