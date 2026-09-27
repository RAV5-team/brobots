import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'

/**
 * outline — светлая плашка с границей, галочка у заголовка («status · локация создана», 12а, 15950:2251);
 * inverse — тёмная плашка с лаймовым кругом ✓ («status · каталог обновлён», А3, 15966:6274).
 */
export type StatusBannerVariant = 'outline' | 'inverse'

interface StatusBannerProps {
  /** «Локация „РЦ Химки“ создана», «Каталог обновлён» — без «✓»: галочка рисуется иконкой (D-03). */
  readonly title: string
  /** Что получилось и что делать дальше — одной строкой (только outline, 12а). */
  readonly description?: string
  /** Следующий шаг справа: «Открыть локацию» (secondary), «Открыть в каталоге» (`ButtonLink variant="accent"`). */
  readonly action?: ReactNode
  readonly variant?: StatusBannerVariant
  readonly className?: string
}

function InverseBanner({ title, action, className }: Omit<StatusBannerProps, 'variant' | 'description'>) {
  const titleId = useId()
  return (
    <section
      role="status"
      aria-labelledby={titleId}
      className={clsx('surface-inverse flex items-center gap-16 rounded-xl bg-inverse px-20 py-16', className)}
    >
      <span aria-hidden className="flex size-40 shrink-0 items-center justify-center rounded-full bg-accent text-text">
        <Check size={20} strokeWidth={3} />
      </span>
      <h2 id={titleId} className="flex-1 type-title-md text-bg">{title}</h2>
      {action}
    </section>
  )
}

/**
 * Плашка успеха над списком после сохранения (components.md: StatusBanner; 15950:2251, 15966:6274).
 * Объявляется скринридером как статус.
 */
export function StatusBanner({ title, description, action, variant = 'outline', className }: StatusBannerProps) {
  const titleId = useId()
  if (variant === 'inverse') return <InverseBanner title={title} action={action} {...(className ? { className } : {})} />
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
