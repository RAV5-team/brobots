import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'

interface StatusBannerProps {
  /** «Локация „РЦ Химки“ создана» — без «✓»: галочка рисуется иконкой (D-03). */
  readonly title: string
  /** Что получилось и что делать дальше — одной строкой. */
  readonly description?: string
  /** Следующий шаг справа: «Открыть локацию». */
  readonly action?: ReactNode
  readonly className?: string
}

/**
 * Плашка успеха над списком после сохранения (components.md: StatusBanner; 15950:2251 «status · локация создана»):
 * граница border-strong, радиус 16, заголовок цветом on-accent. Объявляется скринридером как статус.
 */
export function StatusBanner({ title, description, action, className }: StatusBannerProps) {
  const titleId = useId()
  return (
    <section
      role="status"
      aria-labelledby={titleId}
      className={clsx('flex items-center gap-16 rounded-lg border border-border-strong bg-bg py-16 pr-16 pl-24', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p id={titleId} className="flex items-center gap-4 type-body font-semibold text-on-accent">
          <Check aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
          {title}
        </p>
        {description && <p className="type-caption text-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  )
}
