import { describe, expect, it } from 'vitest'
import { EMPTY_DATA_SOURCE_FORM, toNewDataSource, validateDataSourceForm, type DataSourceForm } from './dataSourceForm'

const TODAY = '2026-09-19'
const EXISTING = [{ name: 'Демо-датасеты объектов' }] as const

const filled: DataSourceForm = {
  ...EMPTY_DATA_SOURCE_FORM,
  name: ' Данные поставщика «Морос», ТТХ AMR 800 ',
  kind: 'specs',
  file: { name: 'moros_amr800_spec.pdf', size: 2_516_582 },
  actualizedOn: '19.09.2026',
}

// Окно А7б (15966:7711): тот же источник, но по ссылке с автообновлением раз в неделю.
const linked: DataSourceForm = { ...filled, locatorKind: 'url', file: null, url: ' https://moros.ru/catalog/amr-800 ' }

describe('validateDataSourceForm (PRD 6.10)', () => {
  it('requires name, type, file and actualization date; status always has a value', () => {
    expect(validateDataSourceForm({ ...EMPTY_DATA_SOURCE_FORM, actualizedOn: '' }, EXISTING, TODAY)).toEqual({
      name: 'required',
      kind: 'required',
      file: 'required',
      actualizedOn: 'required',
    })
  })

  it('accepts a filled form', () => {
    expect(validateDataSourceForm(filled, EXISTING, TODAY)).toEqual({})
  })

  it('rejects a date that is not DD.MM.YYYY or does not exist', () => {
    expect(validateDataSourceForm({ ...filled, actualizedOn: '31.02.2026' }, EXISTING, TODAY)).toEqual({ actualizedOn: 'invalidDate' })
  })

  it('rejects an actualization date in the future [ТЗ 3.3.4]', () => {
    expect(validateDataSourceForm({ ...filled, actualizedOn: '20.09.2026' }, EXISTING, TODAY)).toEqual({ actualizedOn: 'futureDate' })
  })

  it('catches a name that repeats a registered source regardless of case and «ё»', () => {
    expect(validateDataSourceForm({ ...filled, name: ' демо-датасеты  объектов' }, EXISTING, TODAY)).toEqual({ name: 'duplicate' })
  })
})

describe('validateDataSourceForm · ссылка (А7б)', () => {
  it('opens the link variant with weekly auto-refresh, as on the mockup', () => {
    expect(EMPTY_DATA_SOURCE_FORM).toMatchObject({ locatorKind: 'file', url: '', autoRefresh: true, refreshPeriod: 'weekly' })
  })

  it('requires the link instead of the file', () => {
    expect(validateDataSourceForm({ ...linked, url: '  ' }, EXISTING, TODAY)).toEqual({ url: 'required' })
    expect(validateDataSourceForm(linked, EXISTING, TODAY)).toEqual({})
  })

  it('requires the file only in the file variant, even if a link was typed before switching', () => {
    expect(validateDataSourceForm({ ...linked, locatorKind: 'file' }, EXISTING, TODAY)).toEqual({ file: 'required' })
  })

  it('accepts only a full http(s) address', () => {
    for (const url of ['moros.ru/catalog', 'ftp://moros.ru/spec.pdf', 'https://', 'просто текст']) {
      expect(validateDataSourceForm({ ...linked, url }, EXISTING, TODAY)).toEqual({ url: 'invalidUrl' })
    }
  })
})

describe('toNewDataSource', () => {
  it('builds a manual file source with the date as a calendar day', () => {
    expect(toNewDataSource(filled)).toEqual({
      name: 'Данные поставщика «Морос», ТТХ AMR 800',
      kind: 'specs',
      origin: 'open',
      locator: { kind: 'file', fileName: 'moros_amr800_spec.pdf' },
      status: 'confirmed',
      provides: 'ТТХ решений',
      actualizedOn: '2026-09-19',
      refresh: 'manual',
    })
  })

  it('builds a link source with the chosen period when auto-refresh is on', () => {
    expect(toNewDataSource(linked)).toMatchObject({
      locator: { kind: 'url', url: 'https://moros.ru/catalog/amr-800' },
      refresh: 'weekly',
    })
    expect(toNewDataSource({ ...linked, refreshPeriod: 'monthly' }).refresh).toBe('monthly')
  })

  it('keeps a link source manual when auto-refresh is off', () => {
    expect(toNewDataSource({ ...linked, autoRefresh: false }).refresh).toBe('manual')
  })

  it('never gives a file auto-refresh (PRD 6.10)', () => {
    expect(toNewDataSource({ ...filled, autoRefresh: true }).refresh).toBe('manual')
  })
})
