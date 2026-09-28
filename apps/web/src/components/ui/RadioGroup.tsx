import * as RadixRadio from '@radix-ui/react-radio-group'
import { clsx } from 'clsx'
import { useId, type ReactNode } from 'react'

export interface RadioOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Содержимое карточки под заголовком (вариант cards): объём, чипы готовности. */
  readonly description?: ReactNode
  readonly disabled?: boolean
}

// Классы целиком: Tailwind находит утилиты только по полным строкам.
const CARD_COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const

interface RadioGroupProps<T extends string> {
  readonly label: string
  readonly options: readonly RadioOption<T>[]
  readonly value?: T
  readonly defaultValue?: T
  readonly onChange?: (value: T) => void
  readonly disabled?: boolean
  readonly orientation?: 'vertical' | 'horizontal'
  /**
   * list — радиокнопки с подписью (15950:1928); cards — сетка карточек-вариантов: вся карточка выбирает,
   * выбранная — выпуклая с тёмной обводкой («Выбор задачи» шага 1, 16197:368).
   */
  readonly variant?: 'list' | 'cards'
  /** Колонки сетки карточек. */
  readonly columns?: keyof typeof CARD_COLUMNS
  /** Для витрины: состояние первой радиокнопки. */
  readonly 'data-demo-state'?: string
}

const RADIO_CLASS = clsx(
  'flex size-18 shrink-0 items-center justify-center rounded-full bg-surface-muted shadow-inset-sm transition-colors',
  'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
  'data-[state=checked]:bg-inverse data-[state=checked]:shadow-none data-[state=checked]:hover:bg-inverse-hover',
)

/** Карточка-вариант: вся карточка — подпись радио; имя — заголовок, описание — содержимое карточки. */
function RadioCard<T extends string>({ groupId, option, demoState }: { readonly groupId: string; readonly option: RadioOption<T>; readonly demoState: string | undefined }) {
  const id = `${groupId}-${option.value}`
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  return (
    <label
      htmlFor={id}
      className={clsx(
        'flex flex-col gap-8 rounded-lg bg-surface-sunken p-16 ring-inverse transition-[background-color,box-shadow]',
        'has-[[data-state=checked]]:bg-bg has-[[data-state=checked]]:shadow-raised-md has-[[data-state=checked]]:ring-2',
        option.disabled ? 'cursor-not-allowed opacity-(--rav-disabled-opacity)' : 'cursor-pointer hover:bg-surface-muted',
      )}
    >
      <span className="flex items-center gap-12">
        <RadixRadio.Item
          id={id}
          value={option.value}
          disabled={option.disabled ?? false}
          aria-labelledby={titleId}
          aria-describedby={option.description === undefined ? undefined : descriptionId}
          data-demo-state={demoState}
          className={RADIO_CLASS}
        >
          <RadixRadio.Indicator className="size-8 rounded-full bg-on-inverse" />
        </RadixRadio.Item>
        <span id={titleId} className="type-body font-semibold text-text">{option.label}</span>
      </span>
      {option.description !== undefined && <span id={descriptionId} className="flex flex-col items-start gap-8 type-caption text-text-secondary">{option.description}</span>}
    </label>
  )
}

/** Группа радиокнопок 18×18 (components.md: Radio; 15950:1928). Невыбранная — вдавленная, как флажок (D-27). */
export function RadioGroup<T extends string>({ label, options, value, defaultValue, onChange, disabled = false, orientation = 'vertical', variant = 'list', columns = 3, ...demo }: RadioGroupProps<T>) {
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
        variant === 'cards' ? clsx('grid gap-12', CARD_COLUMNS[columns]) : 'flex gap-12',
        variant === 'list' && (orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap gap-x-24'),
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
      )}
    >
      {variant === 'cards' && options.map((option, index) => (
        <RadioCard key={option.value} groupId={groupId} option={option} demoState={index === 0 ? demo['data-demo-state'] : undefined} />
      ))}
      {variant === 'list' && options.map((option, index) => {
        const id = `${groupId}-${option.value}`
        // Выключенная группа уже полупрозрачна целиком — у варианта прозрачность не удваиваем.
        const optionDisabled = !disabled && option.disabled === true
        return (
          <span key={option.value} className={clsx('inline-flex items-center gap-12', optionDisabled && 'opacity-(--rav-disabled-opacity)')}>
            <RadixRadio.Item
              id={id}
              value={option.value}
              disabled={option.disabled ?? false}
              data-demo-state={index === 0 ? demo['data-demo-state'] : undefined}
              className={RADIO_CLASS}
            >
              <RadixRadio.Indicator className="size-8 rounded-full bg-on-inverse" />
            </RadixRadio.Item>
            <label htmlFor={id} className={clsx('type-body text-text', disabled || optionDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
              {option.label}
            </label>
          </span>
        )
      })}
    </RadixRadio.Root>
  )
}
