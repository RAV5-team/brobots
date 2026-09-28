/** Разбор числа, введённого по-русски: «1,5», «20 000» (пробелы разрядов, запятая). Не число — null. */
export function parseDecimal(raw: string): number | null {
  const normalized = raw.replace(/[\s  ]/g, '').replace(',', '.')
  if (normalized === '' || !/^-?\d*\.?\d+$/.test(normalized)) return null
  return Number(normalized)
}
