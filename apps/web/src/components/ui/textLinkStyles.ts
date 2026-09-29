import { clsx } from 'clsx'

/** default — 14 SemiBold (15935:906); subtle — 13 Medium приглушённым цветом: «Сбросить» у фильтров К-2 (16642:2320). */
export type TextActionVariant = 'default' | 'subtle'

const VARIANTS: Record<TextActionVariant, string> = {
  default: 'type-label font-semibold text-text hover:text-text-secondary',
  subtle: 'type-body-sm font-medium text-text-muted hover:text-text',
}

/** Классы текстового действия: общие у TextLink, TextButton и TextAnchor. */
export const textLinkClasses = (className?: string, variant: TextActionVariant = 'default') =>
  clsx(
    'inline-flex items-center gap-4 rounded-xs transition-colors',
    VARIANTS[variant],
    'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
    className,
  )
