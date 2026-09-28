import { clsx } from 'clsx'
import { Minus, Plus } from 'lucide-react'
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'
import { IconButton } from './IconButton'

interface NumberStepperProps {
  /** Подпись строки: «Роботов», «Зарядных станций» — и доступное имя значения. */
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly onChange: (value: number) => void
  /** Пояснение под подписью: «AMR 800 · RaaS», «1 станция на 4 робота». */
  readonly description?: ReactNode
  /** Слот «было»: «было 18 · из подбора» (план вердикта 07). */
  readonly previous?: ReactNode
  /** Слот дельты слева от «−»: «−2». */
  readonly delta?: ReactNode
  readonly disabled?: boolean
  /** Для витрины: состояние значения. */
  readonly 'data-demo-state'?: string | undefined
}

const t = ru.ui.numberStepper

/**
 * Строка числа с кнопками «−» и «+» (components.md: NumberStepper; 16197:1213 — «Состав для проверки», 07 — план вердикта).
 * Значение — `role="spinbutton"`: ↑ → и ↓ ← меняют на шаг, Home и End — к границам. Кнопки — только для мыши,
 * из порядка Tab убраны (шаблон APG), на границе недоступны.
 */
export function NumberStepper({ label, value, min, max, step = 1, onChange, description, previous, delta, disabled = false, ...demo }: NumberStepperProps) {
  const labelId = useId()
  const descriptionId = useId()
  const hasDescription = description !== undefined || previous !== undefined || delta !== undefined

  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next))
    if (!disabled && clamped !== value) onChange(clamped)
  }
  const keys: Record<string, () => void> = {
    ArrowUp: () => { set(value + step) },
    ArrowRight: () => { set(value + step) },
    ArrowDown: () => { set(value - step) },
    ArrowLeft: () => { set(value - step) },
    Home: () => { set(min) },
    End: () => { set(max) },
  }
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  return (
    <div className="flex items-center justify-between gap-16">
      <div className="flex min-w-0 flex-col gap-2">
        <span id={labelId} className="type-body font-medium text-text">{label}</span>
        {hasDescription && (
          <span id={descriptionId} className="type-caption text-text-secondary">
            {description}
            {description !== undefined && previous !== undefined && ' · '}
            {previous}
            {/* Дельта видна у кнопок; для чтения с экрана — в описании. */}
            {delta !== undefined && <>{' '}<span className="sr-only">{delta}</span></>}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-10">
        {delta !== undefined && <span aria-hidden className="type-body text-text-secondary">{delta}</span>}
        <IconButton label={t.decrease(label)} icon={Minus} size={36} tabIndex={-1} disabled={disabled || value <= min} onClick={() => { set(value - step) }} />
        <span
          role="spinbutton"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-disabled={disabled || undefined}
          data-demo-state={demo['data-demo-state']}
          onKeyDown={onKeyDown}
          className={clsx(
            'flex h-36 min-w-48 items-center justify-center rounded-full bg-surface-muted px-16 type-title-sm text-text shadow-inset-sm tabular-nums',
            disabled && 'opacity-(--rav-disabled-opacity)',
          )}
        >
          {value}
        </span>
        <IconButton label={t.increase(label)} icon={Plus} size={36} tabIndex={-1} disabled={disabled || value >= max} onClick={() => { set(value + step) }} />
      </div>
    </div>
  )
}
