import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'

export type BadgeKind = keyof typeof ru.valueBadges

/**
 * field — плашка происхождения у подписи поля (15950:2084: «норматив» с контуром);
 * pill — колонка «Тип» таблиц (А5 15997:409, А2 15966:6095: «норматив» залит, как «точное значение»).
 */
export type BadgeVariant = 'field' | 'pill'

/**
 * Вид плашки — по тону, а не по метке: метки происхождения — одно перечисление (ru.valueBadges),
 * новые метки получают один из трёх тонов. dashed — допущение; filled — формула, точное значение, «из задачи»;
 * outline — норматив, «по умолчанию».
 */
type BadgeTone = 'dashed' | 'filled' | 'outline'

const TONE_OF: Record<BadgeKind, BadgeTone> = {
  assumption: 'dashed',
  formula: 'filled',
  exact: 'filled',
  task: 'filled',
  norm: 'outline',
  default: 'outline',
}

const TONES: Record<BadgeTone, string> = {
  dashed: 'border border-dashed border-border-control bg-bg text-text',
  filled: 'bg-surface-sunken text-text',
  outline: 'border border-border-strong bg-bg text-text-secondary',
}

/** В колонке «Тип» (pill) контурные метки залиты (А5, 15997:409). */
const PILL_TONES: Partial<Record<BadgeTone, BadgeTone>> = { outline: 'filled' }

interface BadgeProps {
  readonly kind: BadgeKind
  readonly variant?: BadgeVariant
  /** Ширина плашки в колонке таблицы (А5: 88). */
  readonly className?: string
}

/**
 * Происхождение значения в поле: допущение, формула, норматив, точное значение, «из задачи», «по умолчанию»
 * (components.md: Badge и Pill · тип — один примитив; 15935:967, 15935:1025, 15950:2084, 15966:6095).
 */
export function Badge({ kind, variant = 'field', className }: BadgeProps) {
  const tone = TONE_OF[kind]
  const look = TONES[variant === 'pill' ? (PILL_TONES[tone] ?? tone) : tone]
  return (
    <span className={clsx('inline-flex h-24 shrink-0 items-center rounded-full px-10 type-caption font-medium whitespace-nowrap', look, className)}>
      {ru.valueBadges[kind]}
    </span>
  )
}
