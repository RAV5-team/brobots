import * as Switch from '@radix-ui/react-switch'
import { clsx } from 'clsx'
import { useId } from 'react'

interface ToggleProps {
  readonly label: string
  readonly checked?: boolean
  readonly defaultChecked?: boolean
  readonly onCheckedChange?: (checked: boolean) => void
  readonly disabled?: boolean
  readonly hideLabel?: boolean
  readonly 'data-demo-state'?: string | undefined
}

/** Переключатель вкл/выкл 36×20 (components.md: Toggle; 15966:7320 — выкл, 15966:7301 — вкл). */
export function Toggle({ label, checked, defaultChecked, onCheckedChange, disabled = false, hideLabel = false, ...demo }: ToggleProps) {
  const id = useId()
  return (
    <span className={clsx('inline-flex items-center gap-12', disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)')}>
      <Switch.Root
        id={id}
        {...(checked !== undefined ? { checked } : {})}
        {...(defaultChecked !== undefined ? { defaultChecked } : {})}
        {...(onCheckedChange ? { onCheckedChange } : {})}
        disabled={disabled}
        data-demo-state={demo['data-demo-state']}
        className={clsx(
          // Выкл — вдавленная дорожка и выпуклый бегунок (15966:7320), вкл — тёмная дорожка без теней (15966:7301).
          'flex h-20 w-36 shrink-0 items-center rounded-full bg-surface-muted px-4 shadow-inset-sm transition-colors',
          'not-disabled:hover:bg-surface-sunken disabled:cursor-not-allowed',
          'data-[state=checked]:bg-inverse data-[state=checked]:shadow-none data-[state=checked]:hover:bg-inverse-hover',
        )}
      >
        <Switch.Thumb className="block size-14 rounded-full bg-bg shadow-raised-sm transition-transform data-[state=checked]:translate-x-14 data-[state=checked]:bg-on-inverse data-[state=checked]:shadow-none" />
      </Switch.Root>
      <label htmlFor={id} className={clsx('type-body text-text', hideLabel && 'sr-only', !disabled && 'cursor-pointer')}>
        {label}
      </label>
    </span>
  )
}
