import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'

interface ModalProps {
  readonly title: string
  readonly description?: string
  /** Кнопка, которая открывает окно; без неё окно управляется open / onOpenChange. */
  readonly trigger?: ReactNode
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** Кнопки внизу справа: «Отмена» и основное действие. */
  readonly footer?: ReactNode
  readonly children: ReactNode
}

/**
 * Модальное окно 620 px (components.md: Modal; 15966:7646).
 * Radix держит фокус внутри, закрывает по Esc и клику по подложке, возвращает фокус на кнопку.
 */
export function Modal({ title, description, trigger, open, onOpenChange, footer, children }: ModalProps) {
  return (
    <Dialog.Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100vh-var(--rav-space-40))] w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col gap-16 overflow-y-auto rounded-2xl bg-bg p-28 focus-visible:outline-none"
        >
          <header className="flex items-start gap-12">
            <div className="flex flex-1 flex-col gap-8">
              <Dialog.Title className="type-display-sm text-text">{title}</Dialog.Title>
              {description && <Dialog.Description className="type-body text-text-secondary">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label={ru.ui.close}
              className="flex size-36 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-text transition-colors hover:bg-surface-muted"
            >
              <X aria-hidden size={16} />
            </Dialog.Close>
          </header>
          {children}
          {/* Футер 84 px: 16 + кнопка 44 + 24 снизу — так в А7 (15966:7697) и А10 (15966:8434). */}
          {footer && <footer className="flex items-center justify-end gap-12 pt-16 pb-24">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
