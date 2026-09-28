import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'

export type BadgeKind = keyof typeof ru.valueBadges

/**
 * field — плашка происхождения у подписи поля (15950:2084: «норматив» с контуром);
 * pill — колонка «Тип» таблиц (А5 15997:409, А2 15966:6095: «норматив» залит, как «точное значение»).
 */
export type BadgeVariant = 'field' | 'pill'

const KINDS: Record<BadgeKind, string> = {
  assumption: 'border border-dashed border-border-control bg-bg text-text',
  formula: 'bg-surface-sunken text-text',
  exact: 'bg-surface-sunken text-text',
  norm: 'border border-border-strong bg-bg text-text-secondary',
}

const PILL_OVERRIDES: Partial<Record<BadgeKind, string>> = {
  norm: 'bg-surface-sunken text-text',
}

interface BadgeProps {
  readonly kind: BadgeKind
  readonly variant?: BadgeVariant
  /** Ширина плашки в колонке таблицы (А5: 88). */
  readonly className?: string
}

/**
 * Происхождение значения в поле: допущение, формула, норматив, точное значение
 * (components.md: Badge и Pill · тип — один примитив; 15935:967, 15935:1025, 15950:2084, 15966:6095).
 */
export function Badge({ kind, variant = 'field', className }: BadgeProps) {
  const look = variant === 'pill' ? (PILL_OVERRIDES[kind] ?? KINDS[kind]) : KINDS[kind]
  return (
    <span className={clsx('inline-flex h-24 shrink-0 items-center rounded-full px-10 type-caption font-medium whitespace-nowrap', look, className)}>
      {ru.valueBadges[kind]}
    </span>
  )
}
