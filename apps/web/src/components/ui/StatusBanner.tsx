import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'

interface StatusBannerProps {
  /** «Каталог обновлён». */
  readonly title: string
  /** Действие справа: «Открыть в каталоге» — `ButtonLink variant="accent"`. */
  readonly action?: ReactNode
}

/**
 * Итог операции над списком: тёмная плашка с лаймовым кругом ✓, заголовком и действием справа
 * (components.md: StatusBanner; А3 «status · каталог обновлён», 15966:6274). Зачитывается вежливо — role="status".
 */
export function StatusBanner({ title, action }: StatusBannerProps) {
  const titleId = useId()
  return (
    <section
      role="status"
      aria-labelledby={titleId}
      className="surface-inverse flex items-center gap-16 rounded-xl bg-inverse px-20 py-16"
    >
      <span aria-hidden className="flex size-40 shrink-0 items-center justify-center rounded-full bg-accent text-text">
        <Check size={20} strokeWidth={3} />
      </span>
      <h2 id={titleId} className="flex-1 type-title-md text-bg">{title}</h2>
      {action}
    </section>
  )
}
