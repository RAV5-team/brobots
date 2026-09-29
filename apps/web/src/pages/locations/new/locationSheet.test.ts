import { describe, expect, it } from 'vitest'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_DEMO_PROFILE } from '@/mocks/fixtures/locationDemo'
import { buildInitialForm, indexParameters } from './locationForm'
import { applyLocationFile, applyLocationSheet, locationSheetCsv } from './locationSheet'

const params = indexParameters(FACILITY_PARAMETERS.filter((p) => p.facilityType === 'warehouse'))
const initial = buildInitialForm(params, LOCATION_DEMO_PROFILE)

describe('locationSheet', () => {
  it('round-trips the form through the template, including a note that contains a semicolon', () => {
    const applied = applyLocationSheet(initial, params, locationSheetCsv(initial, params))
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.unknown).toEqual([])
    expect(applied.form).toMatchObject({
      name: initial.name,
      city: initial.city,
      totalArea: initial.totalArea,
      extras: initial.extras,
    })
    expect(applied.form.staff).toEqual(initial.staff)
  })

  it('writes the value column into the form and keeps an unknown code out of the fields', () => {
    const csv = [
      'Код параметра;Группа;Параметр;Ед. изм.;Значение',
      'loc_name;Основное;Название;;РЦ Подольск',
      'wh_total_area;Площадь;Общая площадь;;15 000',
      'wh_pickers;Персонал;Отборщики;;40',
      'not_a_parameter;Чужое;Чужая строка;;7',
    ].join('\n')
    const applied = applyLocationSheet(initial, params, csv)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.form.name).toBe('РЦ Подольск')
    expect(applied.form.totalArea).toBe('15 000')
    expect(applied.form.staff.find((row) => row.key === 'wh_pickers')?.headcount).toBe('40')
    expect(applied.unknown).toEqual(['not_a_parameter'])
    expect(applied.form.city).toBe(initial.city)
  })

  it('rejects a file that is not the location template', () => {
    expect(applyLocationSheet(initial, params, 'название;город\nРЦ;Москва').ok).toBe(false)
  })

  it('reads a comma-separated file and a Windows-1251 file the way Excel saves them', async () => {
    const comma = 'Код параметра,Группа,Параметр,Ед. изм.,Значение\nloc_name,,,,РЦ Подольск\n'
    const fromComma = await applyLocationFile(initial, params, new File([comma], 'шаблон.csv', { type: 'text/csv' }))
    expect(fromComma.ok && fromComma.form.name).toBe('РЦ Подольск')

    const win = cp1251('Код параметра;Группа;Параметр;Ед. изм.;Значение\r\nloc_name;;;;РЦ Казань\r\n')
    const fromWin = await applyLocationFile(initial, params, new File([bytesOf(win)], 'шаблон.csv'))
    expect(fromWin.ok && fromWin.form.name).toBe('РЦ Казань')
  })

  it('reads a workbook Excel saved as xlsx', async () => {
    const file = new File([bytesOf(workbookWithName('РЦ Тула'))], 'шаблон.xlsx')
    const applied = await applyLocationFile(initial, params, file)
    expect(applied.ok && applied.form.name).toBe('РЦ Тула')
  })
})

/** «Код параметра» и «Значение» лежат в кодировке, которой Excel пересохраняет CSV на русской Windows. */
function bytesOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function cp1251(text: string): Uint8Array {
  const bytes = Array.from(text, (char) => {
    const code = char.charCodeAt(0)
    if (code < 128) return code
    if (code >= 0x410 && code <= 0x44f) return code - 0x350
    throw new Error(`нет байта windows-1251 для ${char}`)
  })
  return new Uint8Array(bytes)
}

function workbookWithName(name: string): Uint8Array {
  const strings = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Код параметра</t></si><si><t>Значение</t></si><si><t>loc_name</t></si><si><t>${name}</t></si>
</sst>`
  const sheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="E1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="E2" t="s"><v>3</v></c></row>
</sheetData></worksheet>`
  return zipStored([
    { name: 'xl/sharedStrings.xml', data: new TextEncoder().encode(strings) },
    { name: 'xl/worksheets/sheet1.xml', data: new TextEncoder().encode(sheet) },
  ])
}

function zipStored(files: readonly { readonly name: string; readonly data: Uint8Array }[]): Uint8Array {
  const u16 = (value: number) => [value & 255, (value >> 8) & 255]
  const u32 = (value: number) => [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255]
  const local: number[] = []
  const central: number[] = []
  let offset = 0
  for (const file of files) {
    const name = [...new TextEncoder().encode(file.name)]
    const data = [...file.data]
    local.push(
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data,
    )
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...name,
    )
    offset = local.length
  }
  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(central.length), ...u32(local.length), ...u16(0),
  ]
  return new Uint8Array([...local, ...central, ...eocd])
}
