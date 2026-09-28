import { describe, expect, it } from 'vitest'
import { UPLOAD_RULES, validateFiles } from './upload'

/** Файл нужного размера без выделения памяти: размер подменяется. */
const sized = (name: string, sizeMb: number) => {
  const f = new File([new Uint8Array(0)], name)
  Object.defineProperty(f, 'size', { value: Math.round(sizeMb * 1024 * 1024) })
  return f
}

describe('upload rules (D-18)', () => {
  it('describes the common rule in one hint', () => {
    expect(UPLOAD_RULES.document.hint).toBe('PDF, Excel, CSV или изображение до 20 МБ')
  })

  it('accepts PDF, Excel, CSV and images up to 20 MB', () => {
    const result = validateFiles('document', [
      sized('report.pdf', 1), sized('data.xlsx', 2), sized('data.xls', 2),
      sized('rows.csv', 0.1), sized('photo.jpg', 5), sized('photo.PNG', 19.9),
    ])
    expect(result.errors).toEqual([])
  })

  it('rejects other formats with a fixable message', () => {
    const { errors } = validateFiles('document', [sized('plan.dwg', 1)])
    expect(errors).toEqual([
      { file: 'plan.dwg', message: 'Формат .dwg не поддерживается. Загрузите PDF, Excel, CSV или изображение' },
    ])
  })

  it('rejects files over 20 MB', () => {
    const { errors } = validateFiles('document', [sized('big.pdf', 20.5)])
    expect(errors[0]?.message).toBe('Файл больше 20 МБ. Уменьшите размер или разделите файл')
  })

  it('requires from 1 to 8 robot photos', () => {
    expect(validateFiles('robotPhoto', []).errors[0]?.message).toBe('Добавьте хотя бы одно фото')
    const nine = Array.from({ length: 9 }, (_, i) => sized(`p${String(i)}.jpg`, 1))
    expect(validateFiles('robotPhoto', nine).errors[0]?.message).toBe('Не больше 8 фото. Уберите лишние: 1')
    expect(validateFiles('robotPhoto', nine.slice(0, 8)).errors).toEqual([])
  })

  it('accepts only images as robot photos', () => {
    expect(validateFiles('robotPhoto', [sized('spec.pdf', 1)]).errors[0]?.message).toBe(
      'Формат .pdf не поддерживается. Загрузите изображение',
    )
  })
})

describe('locationDocument rule (17б; D-18 open, PRD 15 · №55)', () => {
  const named = (name: string) => new File(['x'], name)

  it('accepts a CAD plan that the common rule rejects', () => {
    expect(validateFiles('locationDocument', [named('План склада, этаж 1.dwg')]).errors).toEqual([])
    expect(validateFiles('document', [named('План склада, этаж 1.dwg')]).errors).toHaveLength(1)
  })

  it('accepts a group of 10 photos and limits one upload to 20 files', () => {
    const photos = (n: number) => Array.from({ length: n }, (_, i) => named(`${String(i)}.jpg`))
    expect(validateFiles('locationDocument', photos(10)).errors).toEqual([])
    expect(validateFiles('locationDocument', photos(21)).errors[0]?.message).toBe('Не больше 20 файлов. Уберите лишние: 1')
  })
})
