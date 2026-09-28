import { clsx } from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { INLINE_ACTION_CLASSES } from './buttonStyles'
import { useFieldControl } from './useFieldControl'

export type InputSize = 'lg' | 'md' | 'compact'

/** Текстовое действие справа в капсуле: «Проверить» у ссылки (А7б, 15966:7933). */
export interface InputAction {
  readonly label: string
  /** Имя для чтения с экрана, если видимой подписи мало: «Проверить ссылку на источник». */
  readonly ariaLabel?: string
  readonly onClick: () => void
  readonly disabled?: boolean
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** lg — 60 px (форма входа 05, 15935:95), md — 44 px (формы), compact — 38 px (таблицы, 15997:428). */
  readonly size?: InputSize
  /** Единица справа: «м²», «₽». */
  readonly suffix?: ReactNode
  /** Иконка слева (поиск). */
  readonly leading?: ReactNode
  /** Значение считается формулой: только чтение, приглушённо (15950:2086). */
  readonly computed?: boolean
  /** Ошибка без Field; внутри Field берётся из него. */
  readonly invalid?: boolean
  /** Действие справа внутри капсулы; не отправляет форму. */
  readonly action?: InputAction
  /** Пусто, но понадобится позже: лаймовая обводка (оклад группы без данных, 15950:2125). Ошибка важнее. */
  readonly attention?: boolean
}

/** Текстовое поле во вдавленной капсуле (components.md: Input; 15935:946). */
export function Input({ size = 'md', suffix, leading, computed = false, invalid, attention = false, action, className, id, ...rest }: InputProps) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field?.invalid ?? false
  const SIZES: Record<InputSize, string> = {
    lg: 'py-20 px-24',
    md: clsx('h-44', leading ? 'px-16' : 'px-20'),
    compact: 'h-38 px-16 border border-highlight',
  }

  return (
    <span
      className={clsx(
        'flex w-full items-center gap-8 rounded-full transition-colors',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--rav-focus-ring-color)',
        // Только само поле: занятое действие («Проверяем…») не гасит капсулу.
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-(--rav-disabled-opacity)',
        SIZES[size],
        computed
          ? 'bg-surface-sunken'
          : isInvalid
            ? 'border-(length:--rav-border-width-control) border-danger-border bg-danger-bg shadow-inset-sm'
            : attention
              ? 'border-(length:--rav-border-width-control) border-accent-border bg-surface-muted shadow-inset-sm'
              : size === 'lg'
                ? 'bg-bg shadow-inset-md'
                : 'bg-surface-muted shadow-inset-sm',
        className,
      )}
    >
      {leading && <span aria-hidden className="flex shrink-0 text-text-muted">{leading}</span>}
      <input
        id={id ?? field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid || undefined}
        required={field?.required}
        readOnly={computed || rest.readOnly}
        className={clsx(
          'min-w-0 flex-1 bg-transparent type-body font-semibold outline-none placeholder:font-normal placeholder:text-text-muted disabled:cursor-not-allowed',
          computed ? 'text-text-secondary' : 'text-text',
        )}
        {...rest}
      />
      {suffix && <span className="shrink-0 type-body text-text-muted">{suffix}</span>}
      {action && (
        <button type="button" aria-label={action.ariaLabel} disabled={action.disabled} onClick={action.onClick} className={INLINE_ACTION_CLASSES}>
          {action.label}
        </button>
      )}
    </span>
  )
}
