import * as RadixRadio from '@radix-ui/react-radio-group'
import { clsx } from 'clsx'
import { useId } from 'react'

export interface RadioOption<T extends string> {
  readonly value: T
  readonly label: string
}

interface RadioGroupProps<T extends string> {
  readonly label: string
  readonly options: readonly RadioOption<T>[]
  readonly value?: T
  readonly defaultValue?: T
  readonly onChange?: (value: T) => void
  readonly disabled?: boolean
  readonly orientation?: 'vertical' | 'horizontal'
  /** Для витрины: состояние первой радиокнопки. */
  readonly 'data-demo-state'?: string
}

/** Группа радиокнопок 18×18 (components.md: Radio; 15950:1928). Невыбранная — вдавленная, как флажок (D-27). */
export function RadioGroup<T extends string>({ label, options, value, defaultValue, onChange, disabled = false, orientation = 'vertical', ...demo }: RadioGroupProps<T>) {
  const groupId = useId()
  return (
    <RadixRadio.Root
      aria-label={label}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onChange ? { onValueChange: (v: string) => { onChange(v as T) } } : {})}
      disabled={disabled}
      orientation={orientation}
      className={clsx(
        'flex gap-12',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap gap-x-24',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
      )}
    >
      {options.map((option, index) => {
        const id = `${groupId}-${option.value}`
        return (
          <span key={option.value} className="inline-flex items-center gap-12">
            <RadixRadio.Item
              id={id}
              value={option.value}
              data-demo-state={index === 0 ? demo['data-demo-state'] : undefined}
              className={clsx(
                'flex size-18 shrink-0 items-center justify-center rounded-full bg-surface-muted shadow-inset-sm transition-colors',
                'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
                'data-[state=checked]:bg-inverse data-[state=checked]:shadow-none data-[state=checked]:hover:bg-inverse-hover',
              )}
            >
              <RadixRadio.Indicator className="size-8 rounded-full bg-on-inverse" />
            </RadixRadio.Item>
            <label htmlFor={id} className={clsx('type-body text-text', !disabled && 'cursor-pointer')}>
              {option.label}
            </label>
          </span>
        )
      })}
    </RadixRadio.Root>
  )
}
