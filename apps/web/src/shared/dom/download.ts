/** Табличный текст для Excel: разделитель «;», значения в кавычках при необходимости, BOM для кириллицы. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string): string => (/[;"\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
  return `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`
}

/** Скачать текст файлом: временная ссылка на Blob, без запроса к серверу. */
export function downloadText(fileName: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
