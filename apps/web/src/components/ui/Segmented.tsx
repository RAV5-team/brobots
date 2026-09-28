import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { clsx } from 'clsx'
import { optionValue } from './optionValue'

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Вариант ещё недоступен: виден, но не выбирается. */
  readonly disabled?: boolean
  /** Счётчик после подписи: «Все 7 · Черновики 3» (A1, 16362:8210). Вычисляется, не хранится. */
  readonly count?: number
}

interface SegmentedProps<T extends string> {
  /** Доступное имя группы: у сегментов нет видимой подписи. */
  readonly label: string
  readonly options: readonly SegmentedOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** 40 — эталон 15935:976, 44 — в формах рядом с полями. */
  readonly size?: 40 | 44
  /** fill — сегменты делят ширину поровну; content — по подписи, как в окне А7 (15966:7665, 15966:7677). */
  readonly fit?: 'fill' | 'content'
  readonly disabled?: boolean
  /** Для витрины: состояние первого невыбранного сегмента. */
  readonly 'data-demo-state'?: string | undefined
}

/** Переключатель из 2–4 значений (components.md: Segmented control). Стрелки двигают выбор, пустым не бывает. */
export function Segmented<T extends string>({ label, options, value, onChange, size = 40, fit = 'fill', disabled = false, ...demo }: SegmentedProps<T>) {
  const demoTarget = options.find((o) => o.value !== value)?.value
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      // Radix снимает выбор при повторном нажатии — сегменты всегда держат значение.
      onValueChange={(next) => {
        const option = optionValue(options, next)
        if (option !== undefined) onChange(option)
      }}
      className={clsx(
        'flex gap-4 rounded-full bg-surface-muted p-4 shadow-inset-sm',
        fit === 'fill' ? 'w-full' : 'w-fit',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          data-demo-state={option.value === demoTarget ? demo['data-demo-state'] : undefined}
          className={clsx(
            'group flex items-center justify-center gap-8 rounded-full font-medium whitespace-nowrap text-text-secondary transition-colors',
            size === 40 ? 'h-32' : 'h-36',
            // А7: подпись 13/16 Medium и в выбранном сегменте (15966:7667); эталон 15935:976 — 12/16, выбранный 600.
            fit === 'fill' ? 'flex-1 px-10 type-caption data-[state=on]:px-16 data-[state=on]:font-semibold' : 'px-16 type-body-sm',
            option.disabled && !disabled && 'opacity-(--rav-disabled-opacity)',
            'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
            'data-[state=on]:bg-inverse data-[state=on]:text-on-inverse data-[state=on]:hover:bg-inverse',
          )}
        >
          {option.label}
          {/* Пробел — для чтения с экрана: «Все 7», а не «Все7»; на экране зазор даёт gap. */}
          {option.count !== undefined && ' '}
          {option.count !== undefined && (
            <span className="type-caption font-medium text-text-secondary group-data-[state=on]:text-on-inverse">{option.count}</span>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
