import { describe, expect, it } from 'vitest'
import { HANDLING_METHOD_CODES } from '@/domain'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { PROCESS_DEMO_TEXT, PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { buildInitialForm } from './processDemoForm'
import { categoryValue } from './processForm'
import { applyProcessFile, applyProcessSheet, processSheetCsv, type ProcessSheetCatalog } from './processSheet'

const WAREHOUSE = FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse')
const initial = buildInitialForm(WAREHOUSE, { ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: 0.6 }, PROCESS_DEMO_TEXT)
const catalog: ProcessSheetCatalog = {
  classLocked: false,
  classes: [
    { value: 'OP-01', label: 'OP-01 · Перемещение' },
    { value: 'OP-02', label: 'OP-02 · Сортировка' },
  ],
  categories: [{ value: categoryValue('warehouse', 'internal_logistics'), label: 'Склад · внутренняя логистика' }],
  handlingMethods: HANDLING_METHOD_CODES.map((code) => ({ code, name: code, hint: '' })),
}

describe('processSheet', () => {
  it('round-trips the form through the template', () => {
    const applied = applyProcessSheet(initial, catalog, processSheetCsv(initial, catalog))
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.unknown).toEqual([])
    expect(applied.form).toEqual(initial)
  })

  it('writes the value column into the form and keeps an unknown code out of the fields', () => {
    const role = initial.staff[0]?.role ?? ''
    const csv = [
      'Код параметра;Группа;Параметр;Ед. изм.;Значение',
      'proc_name;Процесс;Название;;Ночная отгрузка',
      'proc_class;Процесс;Класс;;OP-02',
      'dailyVolume;Объём;Объём;;4 000',
      `staff:${role}:share;Исполнители;Доля;;80`,
      `staff:${role}:headcount;Исполнители;Численность;;1`,
      'not_a_field;Чужое;Чужая строка;;7',
    ].join('\n')
    const applied = applyProcessSheet(initial, catalog, csv)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.form.name).toBe('Ночная отгрузка')
    expect(applied.form.operationClass).toBe('OP-02')
    expect(applied.form.dailyVolume).toBe('4 000')
    expect(applied.form.staff.find((row) => row.role === role)?.timeSharePct).toBe('80')
    expect(applied.form.staff.find((row) => row.role === role)?.headcount).toBe(initial.staff[0]?.headcount)
    expect(applied.unknown).toEqual(['not_a_field'])
    expect(applied.form.carrier).toBe(initial.carrier)
  })

  it('keeps the class of a location copy', () => {
    const csv = 'Код параметра;Значение\nproc_class;OP-02\nproc_name;Копия\n'
    const applied = applyProcessSheet(initial, { ...catalog, classLocked: true }, csv)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.form.operationClass).toBe('OP-01')
    expect(applied.form.name).toBe('Копия')
    expect(applied.unknown).toEqual([])
  })

  it('rejects a file that is not the process template', () => {
    expect(applyProcessSheet(initial, catalog, 'название;класс\nОтгрузка;OP-01').ok).toBe(false)
  })

  it('reads a comma-separated file and a Windows-1251 file the way Excel saves them', async () => {
    const comma = 'Код параметра,Группа,Параметр,Ед. изм.,Значение\nproc_name,,,,Ночная отгрузка\n'
    const fromComma = await applyProcessFile(initial, catalog, new File([comma], 'шаблон.csv', { type: 'text/csv' }))
    expect(fromComma.ok && fromComma.form.name).toBe('Ночная отгрузка')

    const win = cp1251('Код параметра;Группа;Параметр;Ед. изм.;Значение\r\nproc_name;;;;РЦ Казань\r\n')
    const fromWin = await applyProcessFile(initial, catalog, new File([bytesOf(win)], 'шаблон.csv'))
    expect(fromWin.ok && fromWin.form.name).toBe('РЦ Казань')
  })
})

function bytesOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function cp1251(text: string): Uint8Array {
  const bytes = Array.from(text).map((char) => {
    const code = char.charCodeAt(0)
    if (code < 128) return code
    if (code >= 0x410 && code <= 0x44f) return code - 0x350
    throw new Error(`нет байта windows-1251 для ${char}`)
  })
  return new Uint8Array(bytes)
}
