import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'

export type BadgeKind = keyof typeof ru.valueBadges

/**
 * field — плашка происхождения у подписи поля (15950:2084: «норматив» с контуром);
 * pill — колонка «Тип» таблиц (А5 15997:409, А2 15966:6095: «норматив» залит, как «точное значение»).
 */
export type BadgeVariant = 'field' | 'pill'

/** Статусы проверки характеристики решения (2.1а, 16830:10) — метки Badge; для К-4 остаются `CharacteristicStatus`. */
export type VerificationStatus = Extract<BadgeKind, 'confirmed' | 'analog' | 'estimate' | 'pending' | 'needsCheck'>

/**
 * Вид плашки — по тону, а не по метке: метки происхождения — одно перечисление (ru.valueBadges),
 * новые метки получают один из тонов. dashed — допущение; filled — формула, точное значение, «из задачи»;
 * outline — норматив, «по умолчанию»; danger-outline — «требует проверки» (красная обводка).
 */
type BadgeTone = 'dashed' | 'filled' | 'outline' | 'danger-outline'

const TONE_OF: Record<BadgeKind, BadgeTone> = {
  assumption: 'dashed',
  formula: 'filled',
  exact: 'filled',
  task: 'filled',
  norm: 'outline',
  default: 'outline',
  // Статусы шага 1 проекта (PRD 11.2): предварительное значение содержит допущения — тоже пунктиром.
  file: 'filled',
  specified: 'filled',
  computed: 'filled',
  location: 'outline',
  preliminary: 'dashed',
  missing: 'outline',
  // Шаг 2: «вне расчёта» и статусы проверки 2.1а — «подтверждено» серое (на К-4 лаймовое — это Chip), «по аналогу» пунктиром.
  outOfScope: 'outline',
  confirmed: 'filled',
  analog: 'dashed',
  estimate: 'outline',
  pending: 'outline',
  needsCheck: 'danger-outline',
}

const TONES: Record<BadgeTone, string> = {
  dashed: 'border border-dashed border-border-control bg-bg text-text',
  filled: 'bg-surface-sunken text-text',
  outline: 'border border-border-strong bg-bg text-text-secondary',
  'danger-outline': 'border border-danger-border bg-bg text-danger',
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
 * Происхождение значения в поле: допущение, формула, норматив, точное значение, «из задачи», «по умолчанию»;
 * статусы шага 1 проекта — из файла, указано, из локации, рассчитано, предварительно, нет данных
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
