import { describe, expect, it } from 'vitest'
import { ru } from './ru'

// Код вне словаря и тестов — где ключи читают. Фикстуры входят: часть ключей берётся по значениям данных (`t.status[row.status]`).
const sources = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/shared/i18n/**', '!/src/api/generated/**'],
  { query: '?raw', import: 'default', eager: true },
)
const code = Object.values(sources).join('\n')

/** Пути всех ключей словаря: `catalog.item.specsTitle`. Элементы массивов — значения, не ключи. */
function keyPaths(node: unknown, prefix: readonly string[] = []): readonly (readonly string[])[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return []
  return Object.entries(node).flatMap(([key, value]) => [[...prefix, key], ...keyPaths(value, [...prefix, key])])
}

// Слова кода — один раз: проверка ~2 500 ключей регэкспом по всему коду нагружала бы соседние тесты.
const words = new Set(code.match(/[\w$]+/g))
/** Ключ-идентификатор — целым словом; ключ с другими символами (`OP-01`) — подстрокой. */
const mentioned = (name: string): boolean => (/^[\w$]+$/.test(name) ? words.has(name) : code.includes(name))

/**
 * Ключ, имя которого не встречается в коде ни разу — ни свойством, ни строкой, — никто не читает: даже динамическое
 * обращение `t[key]` требует этого имени в данных или типах. Одноимённые ключи в разных разделах проверка не различает.
 */
function unusedKeys(): readonly string[] {
  return keyPaths(ru).filter((path) => !mentioned(path.at(-1) ?? '')).map((path) => path.join('.'))
}

describe('словарь ru', () => {
  it('находит исходники и отличает упомянутое имя от неупомянутого', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
    expect(mentioned('projectStepTitles')).toBe(true)
    expect(mentioned('specsTitle')).toBe(false)
  })

  it('каждый ключ где-то читается (иначе — удалить ключ)', () => {
    expect(unusedKeys()).toEqual([])
  })
})
