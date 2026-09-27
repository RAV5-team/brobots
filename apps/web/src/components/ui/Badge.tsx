import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'

export type BadgeKind = keyof typeof ru.valueBadges

const KINDS: Record<BadgeKind, string> = {
  assumption: 'border border-dashed border-border-control bg-bg text-text',
  formula: 'bg-surface-sunken text-text',
  exact: 'bg-surface-sunken text-text',
  norm: 'border border-border-strong bg-bg text-text-secondary',
}

/**
 * Происхождение значения в поле: допущение, формула, норматив, точное значение
 * (components.md: Badge и Pill · тип — один примитив; 15935:967, 15935:1025, 15950:2084, 15966:6095).
 */
export function Badge({ kind }: { readonly kind: BadgeKind }) {
  return (
    <span className={clsx('inline-flex h-24 shrink-0 items-center rounded-full px-10 type-caption font-medium whitespace-nowrap', KINDS[kind])}>
      {ru.valueBadges[kind]}
    </span>
  )
}
