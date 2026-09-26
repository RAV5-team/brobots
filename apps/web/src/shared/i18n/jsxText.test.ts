import { describe, expect, it } from 'vitest'

// Тесты не проверяем: в них тексты интерфейса — ожидаемые значения.
const sources = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true })

/** Кириллица в тексте JSX (между тегами) или в строковых атрибутах подписей. */
function cyrillicInJsx(code: string): string[] {
  const text = [...code.matchAll(/>([^<>{}]*[А-Яа-яЁё][^<>{}]*)</g)].map((m) => (m[1] ?? '').trim())
  const attrs = [...code.matchAll(/\b(?:aria-label|title|placeholder|alt)="([^"]*[А-Яа-яЁё][^"]*)"/g)].map((m) => m[1] ?? '')
  return [...text, ...attrs]
}

describe('UI labels come from ru.ts (глоссарий)', () => {
  it('detects Cyrillic JSX text', () => {
    expect(cyrillicInJsx('<h1>Дашборд</h1><p>{ru.x}</p><img alt="Фото" />')).toEqual(['Дашборд', 'Фото'])
  })

  it.each(Object.entries(sources))('%s has no Cyrillic literals in JSX', (_path, code) => {
    expect(cyrillicInJsx(code)).toEqual([])
  })
})
