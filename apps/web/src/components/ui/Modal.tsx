import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'

export type ModalSize = 'md' | 'form' | 'sm'

// md — окно со списком (15а): 620, p28, gap16, футер без отступа снизу (15950:3082).
// form — окно с формой (А7 15966:7697, А10 15966:8434): как md, футер 84 = 16 + кнопка 44 + 24 снизу.
// sm — подтверждение (17в, 16036:573): 560, p32, gap20, под кнопками 24.
const SIZES: Record<ModalSize, { readonly content: string; readonly header: string; readonly footer: string }> = {
  md: { content: 'w-[620px] gap-16 p-28', header: 'gap-12', footer: '' },
  form: { content: 'w-[620px] gap-16 p-28', header: 'gap-12', footer: 'pb-24' },
  sm: { content: 'w-[560px] gap-20 p-32', header: 'gap-16', footer: 'pb-24' },
}

interface ModalProps {
  readonly title: string
  readonly size?: ModalSize
  readonly description?: string
  /** Кнопка, которая открывает окно; без неё окно управляется open / onOpenChange. */
  readonly trigger?: ReactNode
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** Кнопки внизу справа: «Отмена» и основное действие. */
  readonly footer?: ReactNode
  /** Куда вернуть фокус после закрытия, если кнопки-открывашки больше нет (снятый с локации процесс, 17в). */
  readonly onCloseAutoFocus?: (event: Event) => void
  readonly children?: ReactNode
}

/**
 * Модальное окно (components.md: Modal): 620 px — со списком (15а) или формой (`size="form"`, А7, А10), 560 px — подтверждение (`size="sm"`, 16036:573).
 * Radix держит фокус внутри, закрывает по Esc и клику по подложке, возвращает фокус на кнопку.
 */
export function Modal({ title, size = 'md', description, trigger, open, onOpenChange, footer, onCloseAutoFocus, children }: ModalProps) {
  return (
    <Dialog.Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
          className={clsx(
            'fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100vh-var(--rav-space-40))] max-w-[calc(100vw-var(--rav-space-32))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-bg focus-visible:outline-none',
            SIZES[size].content,
          )}
        >
          <header className={clsx('flex items-start', SIZES[size].header)}>
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
          {footer && <footer className={clsx('flex items-center justify-end gap-12 pt-16', SIZES[size].footer)}>{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
