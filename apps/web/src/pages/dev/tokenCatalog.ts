// Перечень токенов для витрины /dev/tokens: имя токена (без --rav-) и утилита Tailwind.

export const COLOR_TOKENS = [
  'bg', 'surface-sunken', 'surface-muted',
  'border', 'border-strong', 'border-control', 'highlight',
  'text', 'text-secondary', 'text-muted', 'text-disabled',
  'inverse', 'inverse-hover', 'on-inverse', 'accent', 'accent-surface', 'on-accent', 'accent-border',
  'danger', 'danger-border', 'danger-bg', 'scrim',
] as const

export interface TypeToken {
  name: string
  spec: string
}

export const TYPE_TOKENS: readonly TypeToken[] = [
  { name: 'display-xl', spec: 'Unbounded 300 · 64/72 · −0.02em' },
  { name: 'display-lg', spec: 'Unbounded 300 · 32/40 · −0.02em' },
  { name: 'display-md', spec: 'Unbounded 300 · 28/38 · −0.01em' },
  { name: 'display-sm', spec: 'Unbounded 300 · 24/32' },
  { name: 'title-lg', spec: 'Onest 600 · 24/32' },
  { name: 'title-md', spec: 'Onest 600 · 20/28' },
  { name: 'title-sm', spec: 'Onest 600 · 18/24' },
  { name: 'heading', spec: 'Onest 600 · 16/24' },
  { name: 'body', spec: 'Onest 400 · 14/20' },
  { name: 'label', spec: 'Onest 500 · 14/18' },
  { name: 'body-sm', spec: 'Onest 400 · 13/18' },
  { name: 'caption', spec: 'Onest 400 · 12/16' },
  { name: 'overline', spec: 'Onest 500 · 11/16 · 0.08em · UPPERCASE' },
  { name: 'caption-xs', spec: 'Onest 400 · 11/16 · 0.04em' },
]

// Классы перечислены целиком: Tailwind находит утилиты только по полным строкам в исходниках.
export const TYPE_CLASSES: Record<string, string> = {
  'display-xl': 'type-display-xl', 'display-lg': 'type-display-lg', 'display-md': 'type-display-md', 'display-sm': 'type-display-sm',
  'title-lg': 'type-title-lg', 'title-md': 'type-title-md', 'title-sm': 'type-title-sm',
  heading: 'type-heading', body: 'type-body', label: 'type-label', 'body-sm': 'type-body-sm',
  caption: 'type-caption', overline: 'type-overline', 'caption-xs': 'type-caption-xs',
}

export const RADIUS_TOKENS = [
  { name: 'xs', className: 'rounded-xs' },
  { name: 'sm', className: 'rounded-sm' },
  { name: 'md', className: 'rounded-md' },
  { name: 'lg', className: 'rounded-lg' },
  { name: 'xl', className: 'rounded-xl' },
  { name: '2xl', className: 'rounded-2xl' },
  { name: '3xl', className: 'rounded-3xl' },
  { name: 'full', className: 'rounded-full' },
] as const

export const SPACE_TOKENS = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40] as const
export const SIZE_TOKENS = [18, 36, 38, 44, 48] as const

export const SHADOW_TOKENS = [
  { name: 'raised-sm', className: 'shadow-raised-sm', accent: false },
  { name: 'raised-md', className: 'shadow-raised-md', accent: false },
  { name: 'raised-lg', className: 'shadow-raised-lg', accent: false },
  { name: 'inset-sm', className: 'shadow-inset-sm', accent: false },
  { name: 'inset-md', className: 'shadow-inset-md', accent: false },
  { name: 'popover', className: 'shadow-popover', accent: false },
  { name: 'accent-raised', className: 'shadow-accent-raised', accent: true },
  { name: 'accent-inset', className: 'shadow-accent-inset', accent: true },
] as const
