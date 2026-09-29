import * as RadixPopover from '@radix-ui/react-popover'
import { clsx } from 'clsx'
import { useId, type ReactNode } from 'react'

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left'
export type PopoverAlign = 'start' | 'center' | 'end'

/** Имя панели обязательно: видимый заголовок или, без него, `label` для скринридера. */
type PopoverName =
  /** Заголовок панели: «Нет данных для оценки: 2 значения». Он же — доступное имя панели. */
  | { readonly title: string; readonly label?: never }
  /** Доступное имя панели без видимого заголовка (например, разбор балла). */
  | { readonly title?: never; readonly label: string }

type PopoverProps = PopoverName & {
  /** Кнопка-открывашка (Radix `Trigger asChild`): должна быть `<button>` или компонентом, который передаёт ref и пропсы кнопке. */
  readonly trigger: ReactNode
  /** Тело: чипы-якоря, пояснение, строки разбора. */
  readonly children?: ReactNode
  /** Действие внизу во всю ширину: «Уточнить параметры площадки». */
  readonly action?: ReactNode
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly side?: PopoverSide
  readonly align?: PopoverAlign
  /** fixed — 320 (`--rav-popover-width`); content — по содержимому. */
  readonly width?: 'fixed' | 'content'
}

/**
 * Всплывающая панель у кнопки (components.md: Popover; шаг 1 — статус процесса 16969:10, шаг 2 — балл «?» 16325:101).
 * Radix Popover: закрывается по Esc и щелчку вне панели, возвращает фокус на кнопку; поверх Modal (z-50).
 */
export function Popover({
  trigger, title, label, children, action, open, defaultOpen, onOpenChange, side = 'bottom', align = 'start', width = 'fixed',
}: PopoverProps) {
  const titleId = useId()
  return (
    <RadixPopover.Root
      {...(open !== undefined ? { open } : {})}
      {...(defaultOpen !== undefined ? { defaultOpen } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={16}
          {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': label })}
          className={clsx(
            'z-50 flex max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-var(--rav-space-32))] flex-col gap-12 overflow-y-auto rounded-xl bg-bg p-16 shadow-popover',
            width === 'fixed' ? 'w-(--rav-popover-width)' : 'w-max',
          )}
        >
          {title && <p id={titleId} className="type-body font-semibold text-text">{title}</p>}
          {children}
          {action && <div className="flex flex-col pt-4">{action}</div>}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
