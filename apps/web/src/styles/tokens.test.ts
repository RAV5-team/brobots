import { describe, expect, it } from 'vitest'
import themeCss from './theme.css?raw'
import tokensCss from './tokens.css?raw'
import typographyCss from './typography.css?raw'

const names = (matches: IterableIterator<RegExpMatchArray>) =>
  new Set([...matches].flatMap((m) => (m[1] === undefined ? [] : [m[1]])))
const defined = (css: string) => names(css.matchAll(/(--[\w-]+)\s*:/g))
const referenced = (css: string) => names(css.matchAll(/var\((--[\w-]+)\)/g))

const TYPE_SCALE = [
  'display-xl', 'display-lg', 'display-md', 'display-sm', 'title-lg', 'title-md', 'title-sm',
  'heading', 'body', 'label', 'body-sm', 'caption', 'overline', 'caption-xs',
] as const

describe('design tokens', () => {
  const tokens = defined(tokensCss)

  it('prefixes every token with --rav-', () => {
    expect([...tokens].filter((name) => !name.startsWith('--rav-'))).toEqual([])
  })

  it('theme.css references only existing --rav- tokens', () => {
    const refs = referenced(themeCss)
    expect(refs.size).toBeGreaterThan(50)
    expect([...refs].filter((name) => !tokens.has(name))).toEqual([])
  })

  it('theme.css has no self-references', () => {
    const selfRefs = [...themeCss.matchAll(/(--[\w-]+)\s*:\s*var\((--[\w-]+)\)/g)].filter((m) => m[1] === m[2])
    expect(selfRefs.map((m) => m[1])).toEqual([])
  })

  it('tokens.css and typography.css have no dangling var() references', () => {
    const missing = [...referenced(tokensCss), ...referenced(typographyCss)].filter((name) => !tokens.has(name))
    expect(missing).toEqual([])
  })

  it('defines a type-* utility for every step of the type scale', () => {
    const utilities = [...typographyCss.matchAll(/@utility (type-[\w-]+)/g)].map((m) => m[1])
    // type-logo — служебная утилита компонента Logo, не шаг шкалы.
    expect(utilities.filter((name) => name !== 'type-logo')).toEqual(TYPE_SCALE.map((step) => `type-${step}`))
  })

  it('exposes control sizes 18, 36, 38, 44, 48 as spacing', () => {
    for (const px of [18, 36, 38, 44, 48]) {
      expect(themeCss).toContain(`--spacing-${String(px)}: var(--rav-size-${String(px)});`)
    }
  })

  it('keeps hex colors out of theme.css and typography.css', () => {
    expect(themeCss + typographyCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
