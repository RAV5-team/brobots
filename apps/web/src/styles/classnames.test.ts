import { describe, expect, it } from 'vitest'

// Исходники как текст: проверяем классы на запрещённые значения. Классы живут и в .ts (buttonStyles, chartTones); тесты, фикстуры и сгенерированный API — без классов.
const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/*.d.ts', '!/src/mocks/**', '!/src/api/generated/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const SCALE_PX = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 38, 40, 44, 48])

/** Произвольные значения Tailwind с цветом или пикселями из шкалы: bg-[#fff], h-[44px]. */
function forbiddenArbitrary(code: string): string[] {
  const found: string[] = []
  for (const m of code.matchAll(/\b[\w-]+-\[([^\]\s]+)\]/g)) {
    const value = m[1] ?? ''
    const isColor = /^(#|rgb|hsl|oklch|var\(--rav-color)/i.test(value)
    const px = /^(\d+)px$/.exec(value)
    const isScalePx = px !== null && SCALE_PX.has(Number(px[1]))
    if (isColor || isScalePx) found.push(m[0])
  }
  return found
}

/**
 * Числовые утилиты отступов и размеров вне шкалы: у Tailwind с `--spacing-*: initial` (theme.css) для `h-64` или `w-150`
 * нет значения — класс молча не генерируется. Нужный размер — токен `h-(--rav-…)`.
 */
function offScale(code: string): string[] {
  const prefix = String.raw`(?:-?(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|translate-[xy]|scroll-[pm][xytrblse]?)|(?:min-|max-)?[wh]|size|basis|indent)`
  const found: string[] = []
  for (const m of code.matchAll(new RegExp(String.raw`(?<![\w-])${prefix}-(\d+)(?![\w./-])`, 'g'))) {
    if (!SCALE_PX.has(Number(m[1]))) found.push(m[0])
  }
  return found
}

/** Текст только через type-*: размерные text-* и font-<семейство> запрещены. */
function forbiddenTypography(code: string): string[] {
  return [...code.matchAll(/\b(text-(xs|sm|base|lg|[2-9]?xl|display-\w+|title-\w+|heading|body(-sm)?|label|caption(-xs)?|overline)|font-(sans|serif|mono|display))\b/g)].map((m) => m[0])
}

describe('className rules', () => {
  it('finds component sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(3)
  })

  it('detects forbidden arbitrary values', () => {
    expect(forbiddenArbitrary('h-[44px] bg-[#e6e2da] grid-cols-[160px_1fr] w-[1366px]')).toEqual([
      'h-[44px]', 'bg-[#e6e2da]',
    ])
  })

  it('detects numeric utilities off the spacing scale', () => {
    expect(offScale('h-64 w-150 pl-30 -mt-4 gap-x-12 size-18 min-h-44 max-w-6xl grid-cols-3 z-10 duration-300 w-1/2')).toEqual([
      'h-64', 'w-150', 'pl-30',
    ])
  })

  it.each(Object.entries(sources))('%s uses only scale values and type-*', (_path, code) => {
    expect(forbiddenArbitrary(code)).toEqual([])
    expect(offScale(code)).toEqual([])
    expect(forbiddenTypography(code)).toEqual([])
  })
})
