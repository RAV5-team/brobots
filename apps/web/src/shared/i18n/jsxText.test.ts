import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Все `.ts` и `.tsx`, кроме мест, где кириллица — не строка интерфейса:
 * - тесты — в них тексты интерфейса ожидаемые значения;
 * - словарь `shared/i18n` — источник строк;
 * - данные мок-бэкенда (`mocks`, `services/mock`) — то, что пришлёт API: названия, сообщения прогона;
 * - слой локали `shared/format` — «млн», «тыс.», «год/лет» в форматтерах (аудит 2026-09-28, §2);
 * - витрины `/dev/*` — демо-данные макета, в продукт не попадают;
 * - реестр экранов `app/screens.ts` — служебный список для `/dev/screens` и заглушек.
 */
const sources = import.meta.glob<string>([
  '/src/**/*.{ts,tsx}',
  '!/src/**/*.test.{ts,tsx}',
  '!/src/**/*.d.ts',
  '!/src/shared/i18n/**',
  '!/src/mocks/**',
  '!/src/services/mock/**',
  '!/src/shared/format/**',
  '!/src/pages/dev/**',
  '!/src/app/screens.ts',
  // Демо-заполнение форм и требования процесса — до переноса в mocks/fixtures (аудит, PR-8).
  '!/src/pages/**/*.mock.ts',
], { query: '?raw', import: 'default', eager: true })

const CYRILLIC = /[А-Яа-яЁё]/
/** Нормализация поиска «ё» → «е»: буква, а не подпись. */
const NORMALIZATION = /^[ЁёЕе]$/

const literalText = (node: ts.Node): string | null => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => span.literal.text).join('')
  return null
}

/** Строка для разработчика: аргумент `console.*`, `new …Error(…)` или `throw`. */
function isDeveloperText(node: ts.Node, source: ts.SourceFile): boolean {
  for (let parent = node.parent; !ts.isSourceFile(parent); parent = parent.parent) {
    if (ts.isThrowStatement(parent)) return true
    if (ts.isNewExpression(parent) && parent.expression.getText(source).endsWith('Error')) return true
    if (ts.isCallExpression(parent) && parent.expression.getText(source).startsWith('console.')) return true
  }
  return false
}

/**
 * Кириллица в строках кода по AST: текст JSX, атрибуты и пропсы, строки и шаблоны в `.ts` —
 * всё, что может дойти до экрана не через словарь. Возвращает «строка: текст».
 */
function cyrillicLiterals(code: string, fileName = 'file.tsx'): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    const text = literalText(node)
    if (text === null) {
      ts.forEachChild(node, visit)
      return
    }
    const trimmed = text.trim()
    if (!CYRILLIC.test(trimmed) || NORMALIZATION.test(trimmed) || isDeveloperText(node, source)) return
    found.push(`${String(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1)}: ${trimmed}`)
  }
  visit(source)
  return found
}

describe('UI labels come from ru.ts (глоссарий)', () => {
  it('finds Cyrillic in JSX text, attributes, props, strings and templates', () => {
    const code = [
      '<h1>Дашборд</h1>',
      '<p>Итого {x}</p>',
      "<Tile label=\"Площадь\" value={'20 000 м²'} note={`всего ${n} мест`} />",
      "const unit = 'кг'",
    ].join('\n')
    expect(cyrillicLiterals(code)).toEqual(['1: Дашборд', '2: Итого', '3: Площадь', '3: 20 000 м²', '3: всего  мест', "4: кг"])
  })

  it('skips developer text, ё-normalization, comments and the dictionary reference', () => {
    const code = [
      "console.error('Не удалось загрузить', error)",
      "throw new Error(`Проект ${id} не найден`)",
      'Promise.reject(new NotFoundError(`Локация ${id} не найдена`))',
      "name.replaceAll('ё', 'е')",
      '// Комментарий',
      '<p>{ru.title}</p>',
    ].join('\n')
    expect(cyrillicLiterals(code)).toEqual([])
  })

  it.each(Object.entries(sources))('%s has no Cyrillic literals outside the dictionary', (path, code) => {
    expect(cyrillicLiterals(code, path)).toEqual([])
  })
})
