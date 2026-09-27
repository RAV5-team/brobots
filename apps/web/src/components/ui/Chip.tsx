import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ChipTone = 'neutral' | 'muted' | 'unconfirmed' | 'inverse' | 'success' | 'accent' | 'ready'
export type ChipSize = 'xs' | 'sm' | 'md'

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-surface-sunken text-text',
  muted: 'bg-surface-sunken text-text-secondary',
  // Неподтверждённая характеристика позиции каталога: «REST, MQTT» на К-1 (16642:1549), D-64; контраст — D-23.
  unconfirmed: 'bg-surface-sunken text-text-muted',
  inverse: 'bg-inverse text-on-inverse',
  success: 'border border-border-strong bg-bg text-on-accent',
  // Лаймовая плашка на светлом: статус «подтверждено» источника (А6 15966:7295, А7).
  accent: 'bg-accent-surface text-text drop-shadow-popover',
  // Плоская лаймовая плашка без тени: статус «Оценка готова» в списке проектов A1 (16690:13).
  ready: 'bg-accent text-text',
}

// xs — характеристики в таблицах (24 px, 11/16, «до 600 кг»), sm — классы и статусы (24 px), md — классы в карточках (32 px).
const SIZES: Record<ChipSize, string> = {
  xs: 'h-24 px-8 type-caption-xs font-medium',
  sm: 'h-24 px-10 type-caption font-medium',
  md: 'h-32 px-14 type-caption font-medium',
}

interface ChipProps {
  readonly tone?: ChipTone
  readonly size?: ChipSize
  /** Галочка слева: «✓ Готово к расчёту», «✓ Выбран» (D-03 — иконкой). */
  readonly checked?: boolean
  readonly children: ReactNode
}

/** Плашка-метка без действия (components.md: Chip; 15997:287, 15935:312, 15950:2626). */
export function Chip({ tone = 'neutral', size = 'sm', checked = false, children }: ChipProps) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-4 rounded-full whitespace-nowrap', TONES[tone], SIZES[size])}>
      {checked && <Check aria-hidden size={12} strokeWidth={3} />}
      {children}
    </span>
  )
}

interface ChipToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  readonly pressed?: boolean
  readonly defaultPressed?: boolean
  readonly onPressedChange?: (pressed: boolean) => void
  /** Пояснение после подписи обычным начертанием: «Вилы · FMR, штабелёры» (15935:992). */
  readonly description?: string
}

/** Выбираемая плашка 32 px: способы обработки груза, классы операций (09а, А2; 15935:998 / 15935:992). */
export function ChipToggle({ pressed, defaultPressed = false, onPressedChange, description, children, className, ...rest }: ChipToggleProps) {
  const [inner, setInner] = useState(defaultPressed)
  const isPressed = pressed ?? inner
  return (
    <button
      type="button"
      aria-pressed={isPressed}
      onClick={() => {
        const next = !isPressed
        setInner(next)
        onPressedChange?.(next)
      }}
      className={clsx(
        'inline-flex h-32 items-center gap-8 rounded-full px-16 type-caption whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
        isPressed
          ? 'bg-inverse font-semibold text-on-inverse not-disabled:hover:bg-inverse-hover'
          : 'bg-surface-sunken font-medium text-text-secondary not-disabled:hover:bg-surface-muted',
        className,
      )}
      {...rest}
    >
      {isPressed && <Check aria-hidden size={12} strokeWidth={3} />}
      {children}
      {description && (
        <span className={clsx('font-normal', isPressed ? 'text-text-disabled' : 'text-text-muted')}>{description}</span>
      )}
    </button>
  )
}
