const CODE_HEADER = 'Код параметра'
const VALUE_HEADER = 'Значение'

/** Таблица из файла, который Excel сохраняет после правки шаблона: CSV, кодировка Windows или книга .xlsx. */
export async function tableFromFile(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return tableFromXlsx(bytes)
  for (const text of decodeTexts(buffer)) {
    const table = tableFromText(text)
    if (hasTemplateHeader(table)) return table
  }
  return tableFromText(new TextDecoder('utf-8').decode(buffer))
}

export function tableFromText(text: string): string[][] {
  for (const delimiter of [';', '\t', ',']) {
    const table = parseCsv(text, delimiter)
    if (hasTemplateHeader(table)) return table
  }
  return parseCsv(text, ';')
}

export function hasTemplateHeader(table: readonly (readonly string[])[]): boolean {
  return table.some((row) => row.some((cell) => cleanCell(cell) === CODE_HEADER) && row.some((cell) => cleanCell(cell) === VALUE_HEADER))
}

export const cleanCell = (cell: string): string => cell.replace(/^\uFEFF/, '').trim()

function decodeTexts(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return [new TextDecoder('utf-16le').decode(buffer)]
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return [new TextDecoder('utf-16be').decode(buffer)]
  return [new TextDecoder('utf-8').decode(buffer), new TextDecoder('windows-1251').decode(buffer)]
}

function parseCsv(text: string, delimiter: string): string[][] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch ?? ''
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch ?? ''
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function tableFromXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes)
  const sheetName = [...files.keys()].find((name) => name === 'xl/worksheets/sheet1.xml')
    ?? [...files.keys()].find((name) => name.startsWith('xl/worksheets/') && name.endsWith('.xml'))
  const sheet = sheetName ? files.get(sheetName) : undefined
  if (!sheet) return []
  const strings = sharedStrings(files.get('xl/sharedStrings.xml'))
  return sheetRows(xml(sheet), strings)
}

function sharedStrings(file: Uint8Array | undefined): readonly string[] {
  if (!file) return []
  return [...xml(file).getElementsByTagNameNS('*', 'si')].map((item) =>
    [...item.getElementsByTagNameNS('*', 't')].map((node) => node.textContent ?? '').join(''),
  )
}

function sheetRows(document: XMLDocument, strings: readonly string[]): string[][] {
  return [...document.getElementsByTagNameNS('*', 'row')].map((row) => {
    const line: string[] = []
    for (const cell of row.getElementsByTagNameNS('*', 'c')) {
      const column = columnIndex(cell.getAttribute('r') ?? 'A')
      while (line.length < column) line.push('')
      line[column] = cellText(cell, strings)
    }
    return line
  })
}

function cellText(cell: Element, strings: readonly string[]): string {
  const kind = cell.getAttribute('t')
  if (kind === 'inlineStr') return [...cell.getElementsByTagNameNS('*', 't')].map((node) => node.textContent ?? '').join('')
  const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? ''
  if (kind === 's') return strings[Number(raw)] ?? ''
  return raw
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? 'A'
  let index = 0
  for (const char of letters) index = index * 26 + (char.toUpperCase().charCodeAt(0) - 64)
  return index - 1
}

function xml(bytes: Uint8Array): XMLDocument {
  const text = new TextDecoder('utf-8').decode(bytes)
  return new DOMParser().parseFromString(text, 'application/xml')
}

async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(bytes)
  if (eocd < 0) return new Map()
  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break
    const method = view.getUint16(cursor + 10, true)
    const compressed = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = new TextDecoder('utf-8').decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
    const localName = view.getUint16(localOffset + 26, true)
    const localExtra = view.getUint16(localOffset + 28, true)
    const dataOffset = localOffset + 30 + localName + localExtra
    files.set(name, await entryBytes(bytes.subarray(dataOffset, dataOffset + compressed), method))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
}

function findEocd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 0xffff)
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i
  }
  return -1
}

async function entryBytes(data: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return data
  if (method !== 8) return new Uint8Array()
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
