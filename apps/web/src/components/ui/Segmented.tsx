import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { clsx } from 'clsx'

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: string
}

interface SegmentedProps<T extends string> {
  /** Доступное имя группы: у сегментов нет видимой подписи. */
  readonly label: string
  readonly options: readonly SegmentedOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** 40 — эталон 15935:976, 44 — в формах рядом с полями. */
  readonly size?: 40 | 44
  readonly disabled?: boolean
  /** Для витрины: состояние первого невыбранного сегмента. */
  readonly 'data-demo-state'?: string | undefined
}

/** Переключатель из 2–4 значений (components.md: Segmented control). Стрелки двигают выбор, пустым не бывает. */
export function Segmented<T extends string>({ label, options, value, onChange, size = 40, disabled = false, ...demo }: SegmentedProps<T>) {
  const demoTarget = options.find((o) => o.value !== value)?.value
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      // Radix снимает выбор при повторном нажатии — сегменты всегда держат значение.
      onValueChange={(next) => { if (next) onChange(next as T) }}
      className={clsx(
        'flex w-full gap-4 rounded-full bg-surface-muted p-4 shadow-inset-sm',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          data-demo-state={option.value === demoTarget ? demo['data-demo-state'] : undefined}
          className={clsx(
            'flex flex-1 items-center justify-center rounded-full px-10 type-caption font-medium whitespace-nowrap text-text-secondary transition-colors',
            size === 40 ? 'h-32' : 'h-36',
            'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
            'data-[state=on]:bg-inverse data-[state=on]:px-16 data-[state=on]:font-semibold data-[state=on]:text-on-inverse data-[state=on]:hover:bg-inverse',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
