import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useId } from 'react'

interface CheckboxProps {
  readonly label: string
  readonly checked?: boolean
  readonly defaultChecked?: boolean
  readonly onCheckedChange?: (checked: boolean) => void
  readonly disabled?: boolean
  /** Скрыть подпись визуально (в таблицах подпись — заголовок колонки). */
  readonly hideLabel?: boolean
  readonly 'data-demo-state'?: string
}

/** Флажок 18×18 (components.md: Checkbox; 15935:847 — пустой, 15935:1139 — выбран). */
export function Checkbox({ label, checked, defaultChecked, onCheckedChange, disabled = false, hideLabel = false, ...demo }: CheckboxProps) {
  const id = useId()
  return (
    <span className={clsx('inline-flex items-center gap-12', disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)')}>
      <RadixCheckbox.Root
        id={id}
        {...(checked !== undefined ? { checked } : {})}
        {...(defaultChecked !== undefined ? { defaultChecked } : {})}
        {...(onCheckedChange ? { onCheckedChange: (v: boolean | 'indeterminate') => { onCheckedChange(v === true) } } : {})}
        disabled={disabled}
        data-demo-state={demo['data-demo-state']}
        className={clsx(
          'flex size-18 shrink-0 items-center justify-center rounded-xs bg-surface-muted shadow-inset-sm transition-colors',
          'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
          'data-[state=checked]:bg-inverse data-[state=checked]:shadow-none data-[state=checked]:hover:bg-inverse-hover',
        )}
      >
        <RadixCheckbox.Indicator>
          <Check aria-hidden size={12} strokeWidth={3} className="text-on-inverse" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={id} className={clsx('type-body text-text', hideLabel && 'sr-only', !disabled && 'cursor-pointer')}>
        {label}
      </label>
    </span>
  )
}
