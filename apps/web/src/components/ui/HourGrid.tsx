import { clsx } from 'clsx'
import { useRef, type KeyboardEvent } from 'react'
import { hourText } from './hourText'

/** Каждые сколько часов подпись под ячейкой (16197:1543: 00, 04, 08 …). */
const LABEL_EVERY = 4

interface HourGridProps {
  /** Подпись ряда слева: «Приёмка». Она же — имя группы для чтения с экрана. */
  readonly label: string
  /** Часы 0–23 в порядке показа: от начала первой смены. */
  readonly hours: readonly number[]
  readonly selected: readonly number[]
  /** Часы вне смен: видны, но не отмечаются. */
  readonly disabledHours?: readonly number[]
  /** Доступное имя ячейки: «07:00–08:00». */
  readonly hourLabel: (hour: number) => string
  readonly onChange: (selected: readonly number[]) => void
  /** Подписи часов под ячейками — у последнего ряда. */
  readonly showHourLabels?: boolean
  readonly disabled?: boolean
}

const toggled = (selected: readonly number[], hour: number): readonly number[] =>
  selected.includes(hour) ? selected.filter((h) => h !== hour) : [...selected, hour].sort((a, b) => a - b)

/**
 * Сетка часов суток с отметкой нескольких сразу (components.md: HourGrid; пиковые часы 05, 16197:1541).
 * Ячейка — кнопка-переключатель `aria-pressed`; в ряд попадает одна остановка Tab, стрелки, Home и End двигают фокус.
 */
export function HourGrid({ label, hours, selected, disabledHours = [], hourLabel, onChange, showHourLabels = false, disabled = false }: HourGridProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const firstEnabled = hours.findIndex((h) => !disabledHours.includes(h))
  const focusable = (index: number): boolean => index >= 0 && index < hours.length && !disabledHours.includes(hours[index] ?? -1)

  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < hours.length; i += step) {
      if (focusable(i)) {
        refs.current[i]?.focus()
        return
      }
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => { move(index, 1) },
      ArrowLeft: () => { move(index, -1) },
      Home: () => { move(-1, 1) },
      End: () => { move(hours.length, -1) },
    }
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  return (
    <div role="group" aria-label={label} className="flex items-start gap-12">
      <span aria-hidden className="w-(--rav-hour-grid-label-width) shrink-0 pt-4 type-caption text-text-secondary">{label}</span>
      <div className="flex min-w-0 flex-1 gap-2">
        {hours.map((hour, index) => {
          const off = disabledHours.includes(hour)
          const on = selected.includes(hour)
          return (
            <div key={hour} className="flex min-w-0 flex-1 flex-col items-center gap-4">
              <button
                ref={(node) => { refs.current[index] = node }}
                type="button"
                aria-pressed={on}
                aria-label={hourLabel(hour)}
                disabled={disabled || off}
                tabIndex={index === firstEnabled ? 0 : -1}
                onClick={() => { onChange(toggled(selected, hour)) }}
                onKeyDown={(e) => { onKeyDown(e, index) }}
                className={clsx(
                  'h-(--rav-hour-grid-cell-height) w-full rounded-sm transition-colors',
                  off ? 'border border-dashed border-border-strong bg-transparent'
                    : on ? 'bg-inverse not-disabled:hover:bg-inverse-hover'
                      : 'bg-surface-sunken not-disabled:hover:bg-border',
                  disabled && !off && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
                  off && 'cursor-not-allowed',
                )}
              />
              {showHourLabels && (
                <span aria-hidden className={clsx('type-caption-xs text-text-secondary', index % LABEL_EVERY !== 0 && 'invisible')}>
                  {hourText(hour)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
