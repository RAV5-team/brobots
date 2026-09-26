import * as RadixSelect from '@radix-ui/react-select'
import { clsx } from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { useFieldControl } from './useFieldControl'

export interface SelectOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Вторая строка опции (опция 64 px, 15950:3034). */
  readonly description?: string
}

interface SelectProps<T extends string> {
  readonly options: readonly SelectOption<T>[]
  readonly value?: T
  readonly defaultValue?: T
  readonly onChange?: (value: T) => void
  readonly placeholder?: string
  /** field — поле формы (15935:938), filter — кнопка-фильтр над списком (15935:293). */
  readonly variant?: 'field' | 'filter'
  readonly disabled?: boolean
  readonly 'aria-label'?: string
  readonly 'data-demo-state'?: string
}

const TRIGGER: Record<'field' | 'filter', string> = {
  field: 'h-44 w-full justify-between bg-surface-muted px-20 type-body font-semibold text-text not-disabled:hover:bg-surface-sunken',
  filter: 'h-44 bg-bg px-16 type-body-sm font-medium text-text shadow-raised-sm not-disabled:hover:bg-surface-muted data-[state=open]:shadow-inset-sm',
}

/** Выбор одного значения (components.md: Select / Option). Список — во всплывающей панели (D-27). */
export function Select<T extends string>({
  options, value, defaultValue, onChange, placeholder, variant = 'field', disabled = false, ...aria
}: SelectProps<T>) {
  const field = useFieldControl()

  return (
    <RadixSelect.Root
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onChange ? { onValueChange: (v: string) => { onChange(v as T) } } : {})}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={field?.id}
        aria-label={aria['aria-label']}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        data-demo-state={aria['data-demo-state']}
        className={clsx(
          'inline-flex items-center gap-8 rounded-full text-left whitespace-nowrap transition-[background-color,box-shadow]',
          'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
          // У фильтра подсказка — это его подпись («Класс операции», 15935:293): тем же цветом и весом, что выбранное значение.
          variant === 'field' && 'data-placeholder:font-normal data-placeholder:text-text-muted',
          TRIGGER[variant],
          field?.invalid && 'border-[1.5px] border-danger-border bg-danger-bg',
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown aria-hidden size={16} className="text-text" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={8}
          className="z-20 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl bg-bg py-8 shadow-raised-lg"
        >
          <RadixSelect.Viewport className="flex flex-col gap-4 px-8">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={clsx(
                  'flex cursor-pointer items-center gap-12 rounded-md px-12 outline-none select-none',
                  option.description ? 'py-12' : 'h-36',
                  'data-highlighted:bg-surface-muted data-[state=checked]:bg-surface-sunken data-disabled:cursor-not-allowed data-disabled:opacity-(--rav-disabled-opacity)',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  {/* ItemText копируется в кнопку выбора — оформление снаружи, чтобы кнопка сохранила свой шрифт. */}
                  <span className="type-body text-text">
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  </span>
                  {option.description && <span className="type-caption text-text-muted">{option.description}</span>}
                </span>
                <RadixSelect.ItemIndicator>
                  <Check aria-hidden size={16} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
