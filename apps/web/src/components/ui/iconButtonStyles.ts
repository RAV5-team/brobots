import { clsx } from 'clsx'

export type IconButtonSize = 24 | 36 | 44
export type IconButtonVariant = 'raised' | 'ghost'
export type IconButtonTone = 'default' | 'danger'

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow,color] ' +
  'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)'

const VARIANTS: Record<IconButtonVariant, string> = {
  raised: 'bg-bg shadow-raised-sm not-disabled:hover:bg-surface-muted not-disabled:active:shadow-inset-sm',
  ghost: 'not-disabled:hover:bg-surface-muted',
}
const TONES: Record<IconButtonVariant, Record<IconButtonTone, string>> = {
  raised: { default: 'text-text', danger: 'text-danger' },
  ghost: { default: 'text-text-muted not-disabled:hover:text-text', danger: 'text-danger' },
}
const SIZES: Record<IconButtonSize, string> = { 24: 'size-24', 36: 'size-36', 44: 'size-44' }
export const ICON_SIZES: Record<IconButtonSize, number> = { 24: 14, 36: 16, 44: 16 }

/** Классы круга; отдельно от кнопки — когда круг лишь часть кнопки побольше (строка шаблона в окне 15а). */
export function iconButtonClasses(size: IconButtonSize, variant: IconButtonVariant, tone: IconButtonTone, className?: string): string {
  return clsx(BASE, VARIANTS[variant], TONES[variant][tone], SIZES[size], className)
}
