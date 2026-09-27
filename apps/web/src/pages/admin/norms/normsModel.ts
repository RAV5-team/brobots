import type { Norm, NormChange } from '@/domain'
import { formatNumber } from '@/shared/format'

/** Сколько знаков после запятой показывать: в справочнике есть 1,302. */
const MAX_FRACTION_DIGITS = 3
const NUMBER_PATTERN = /^\d+(\.\d+)?$/

export type NormValueError = 'empty' | 'notNumber' | 'negative'

export type ParsedNormValue =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: NormValueError }

/** Правки администратора: код норматива → текст в поле. Нет ключа — поле не трогали. */
export type NormDraft = Readonly<Record<string, string>>

export interface NormRow {
  readonly norm: Norm
  /** Что показать в поле: правка или сохранённое значение. */
  readonly text: string
  readonly isDirty: boolean
  readonly error: NormValueError | null
}

/** Значение как на экране А5: «1,302», «250 000», «±10». */
export function formatNormValue(norm: Norm): string {
  return `${norm.symmetric ? '±' : ''}${formatNumber(norm.value, MAX_FRACTION_DIGITS)}`
}

/** Ввод администратора → число. Запятая и точка — дробная часть, пробелы разрядов и «±» допуска игнорируются. */
export function parseNormValue(text: string): ParsedNormValue {
  // \s в JS покрывает и неразрывный пробел, которым Intl разделяет разряды.
  const compact = text.replace(/\s/g, '').replace(/^±/, '').replace(',', '.')
  if (compact === '') return { ok: false, error: 'empty' }
  if (compact.startsWith('-') && NUMBER_PATTERN.test(compact.slice(1))) return { ok: false, error: 'negative' }
  if (!NUMBER_PATTERN.test(compact)) return { ok: false, error: 'notNumber' }
  return { ok: true, value: Number(compact) }
}

function toRow(norm: Norm, draft: NormDraft): NormRow {
  const edited = draft[norm.code]
  if (edited === undefined) return { norm, text: formatNormValue(norm), isDirty: false, error: null }
  const parsed = parseNormValue(edited)
  if (!parsed.ok) return { norm, text: edited, isDirty: true, error: parsed.error }
  return { norm, text: edited, isDirty: parsed.value !== norm.value, error: null }
}

export function buildNormRows(norms: readonly Norm[], draft: NormDraft): readonly NormRow[] {
  return norms.map((norm) => toRow(norm, draft))
}

/** Что уйдёт в сохранение: только изменённые значения; с ошибками сохранять нельзя. */
export function collectNormChanges(norms: readonly Norm[], draft: NormDraft): { readonly changes: readonly NormChange[]; readonly invalidCount: number } {
  const rows = buildNormRows(norms, draft)
  const changes = rows.flatMap((row): NormChange[] => {
    if (!row.isDirty || row.error) return []
    const parsed = parseNormValue(row.text)
    return parsed.ok ? [{ code: row.norm.code, value: parsed.value }] : []
  })
  return { changes, invalidCount: rows.filter((row) => row.error !== null).length }
}
