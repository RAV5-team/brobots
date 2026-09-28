import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'

export type ModalSize = 'md' | 'form' | 'sm' | 'wide' | 'side'

// md — окно со списком (15а): 620, p28, gap16, футер без отступа снизу (15950:3082).
// form — окно с формой (А7 15966:7697, А10 15966:8434): как md, футер 84 = 16 + кнопка 44 + 24 снизу.
// sm — подтверждение (17в, 16036:573): 560, p32, gap20, под кнопками 24.
// wide — выбор из таблицы (A2, 16429:2): 640, p32, gap20; футер отделён только зазором 20.
// side — боковая панель справа на всю высоту (03a, 16202:979): 560, левые углы 32; шапка px28 pt24 pb12,
// тело прокручивается px28 pb20, подвал на `surface-muted` px28 pt16 pb24.
const SIZES: Record<ModalSize, { readonly content: string; readonly header: string; readonly footer: string }> = {
  md: { content: 'w-[620px] gap-16 p-28', header: 'gap-12', footer: 'pt-16' },
  form: { content: 'w-[620px] gap-16 p-28', header: 'gap-12', footer: 'pt-16 pb-24' },
  sm: { content: 'w-[560px] gap-20 p-32', header: 'gap-16', footer: 'pt-16 pb-24' },
  wide: { content: 'w-(--rav-modal-wide-width) gap-20 p-32', header: 'gap-16', footer: '' },
  side: { content: 'w-(--rav-modal-side-width)', header: 'gap-12 px-28 pt-24 pb-12', footer: 'bg-surface-muted px-28 pt-16 pb-24' },
}

const CENTERED = 'top-1/2 left-1/2 max-h-[calc(100vh-var(--rav-space-40))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl'
const SIDE = 'inset-y-0 right-0 h-full rounded-l-3xl shadow-raised-lg'

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
 * Модальное окно (components.md: Modal): 620 px — со списком (15а) или формой (`size="form"`, А7, А10), 560 px — подтверждение (`size="sm"`, 16036:573),
 * 640 px — выбор строки таблицы (`size="wide"`, A2, 16429:2), боковая панель справа (`size="side"`, 03a, 16202:979):
 * шапка и подвал на месте, прокручивается только тело — область с именем по заголовку.
 * Radix держит фокус внутри, закрывает по Esc и клику по подложке, возвращает фокус на кнопку.
 */
export function Modal({ title, size = 'md', description, trigger, open, onOpenChange, footer, onCloseAutoFocus, children }: ModalProps) {
  const side = size === 'side'
  return (
    <Dialog.Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
          className={clsx(
            'fixed z-40 flex max-w-[calc(100vw-var(--rav-space-32))] flex-col bg-bg focus-visible:outline-none',
            side ? SIDE : CENTERED,
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
          {side
            ? (
                // Прокручиваемая область — в порядке Tab, чтобы её можно было листать с клавиатуры.
                <section aria-label={title} tabIndex={0} className="flex min-h-0 flex-1 flex-col gap-16 overflow-y-auto px-28 pb-20">
                  {children}
                </section>
              )
            : children}
          {footer && <footer className={clsx('flex items-center justify-end gap-12', SIZES[size].footer)}>{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
