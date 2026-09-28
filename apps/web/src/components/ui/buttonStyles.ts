import { clsx } from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent'
export type ButtonSize = 'md' | 'sm'

export interface ButtonStyle {
  readonly variant?: ButtonVariant | undefined
  readonly size?: ButtonSize | undefined
}

const BASE =
  'inline-flex items-center justify-center gap-8 rounded-full font-semibold whitespace-nowrap transition-[background-color,box-shadow] ' +
  'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)'

// D-02: наведение — фон на шаг темнее (у тёмной — светлее), нажатие — выпуклая тень меняется на вдавленную.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border border-highlight bg-inverse text-on-inverse not-disabled:hover:bg-inverse-hover',
  secondary: 'bg-bg text-text shadow-raised-sm not-disabled:hover:bg-surface-muted not-disabled:active:shadow-inset-sm',
  danger: 'bg-bg text-danger shadow-raised-sm not-disabled:hover:bg-surface-muted not-disabled:active:shadow-inset-sm',
  // Лаймовая кнопка на тёмной плашке: «Открыть в каталоге» (А3, 16057:6).
  accent: 'bg-accent text-text not-disabled:hover:bg-accent-border',
}

// 15935:205 / 15966:8039 — h44, 14/20; 15935:150 «Все проекты» — тоже h44, но 13/18 (сверено на экране 06).
const SIZES: Record<ButtonSize, string> = {
  md: 'h-44 px-16 type-body',
  sm: 'h-44 px-16 type-body-sm',
}

export function buttonClasses({ variant = 'secondary', size = 'md' }: ButtonStyle, className?: string): string {
  return clsx(BASE, VARIANTS[variant], SIZES[size], className)
}

/** Текстовое действие внутри капсулы поля: «Заменить» у FileInput (15966:7670), «Проверить» у Input (15966:7933). */
export const INLINE_ACTION_CLASSES =
  'shrink-0 rounded-full type-body font-semibold text-text transition-colors not-disabled:hover:text-text-secondary disabled:cursor-not-allowed'

/**
 * Пилюля фильтра К-1 (16642:643, 16642:664): h44, px16, 13/18 Medium, `raised-sm`; открытая — вдавленная.
 * Кнопка MultiSelectFilter и «Сравнить (N)» — одна форма, как `Select variant="filter"`.
 * `data-active` — выбран хотя бы один фильтр: тёмная пилюля с лаймовой подписью (К-2, 16642:2300).
 */
export const FILTER_PILL_CLASSES =
  'inline-flex h-44 items-center gap-8 rounded-full bg-bg px-16 type-body-sm font-medium whitespace-nowrap text-text shadow-raised-sm ' +
  'transition-[background-color,box-shadow] not-disabled:hover:bg-surface-muted data-[state=open]:shadow-inset-sm not-disabled:active:shadow-inset-sm ' +
  'data-[active=true]:bg-inverse data-[active=true]:text-on-inverse data-[active=true]:not-disabled:hover:bg-inverse-hover ' +
  'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)'
