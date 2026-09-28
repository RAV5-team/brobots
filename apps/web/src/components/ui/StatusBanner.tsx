import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Card } from './Card'

/**
 * outline — светлая плашка с границей, галочка у заголовка («status · локация создана», 12а, 15950:2251);
 * inverse — тёмная плашка с лаймовым кругом ✓ («status · каталог обновлён», А3, 15966:6274);
 * danger — предупреждение без иконки на `danger-bg` («warning» отчёта 09, 16197:2325): дисклеймер ТЗ 3.7.5.
 * Не статус операции, а постоянная пометка — объявляется как `note`, а не `status`.
 * accent — лаймовая вдавленная плашка «данные устарели» (D-89): подбор и прогон посчитаны по прежним параметрам;
 * справа — действие («Пересчитать»), под текстом — дополнительные строки (`children`).
 */
export type StatusBannerVariant = 'outline' | 'inverse' | 'danger' | 'accent'

interface StatusBannerProps {
  /** «Локация „РЦ Химки“ создана», «Каталог обновлён» — без «✓»: галочка рисуется иконкой (D-03). */
  readonly title: string
  /** Что получилось и что делать дальше — одной строкой (outline 12а, danger, accent). */
  readonly description?: string
  /** Следующий шаг справа: «Открыть локацию» (secondary), «Открыть в каталоге» (`ButtonLink variant="accent"`). */
  /** accent — «Пересчитать» подбор (D-89). */
  readonly action?: ReactNode
  readonly variant?: StatusBannerVariant
  readonly className?: string
  /** Строки под текстом (только accent): пояснение мока, ошибка действия. */
  readonly children?: ReactNode
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

function DangerBanner({ title, description, className }: Omit<StatusBannerProps, 'variant' | 'action'>) {
  const titleId = useId()
  return (
    <section role="note" aria-labelledby={titleId} className={clsx('flex flex-col gap-4 rounded-md bg-danger-bg px-20 py-16', className)}>
      <p id={titleId} className="type-body-sm font-semibold text-danger">{title}</p>
      {description && <p className="type-caption text-danger">{description}</p>}
    </section>
  )
}

function AccentBanner({ title, description, action, children }: Omit<StatusBannerProps, 'variant' | 'className'>) {
  const titleId = useId()
  const heading = <h2 id={titleId} className="type-body font-semibold text-on-accent">{title}</h2>
  const text = description && <p className="type-caption text-on-accent">{description}</p>
  if (action === undefined && children === undefined) {
    return (
      <Card as="section" variant="accent" padding={20} gap={4} role="status" aria-labelledby={titleId}>
        {heading}
        {text}
      </Card>
    )
  }
  return (
    <Card as="section" variant="accent" padding={20} gap={8} role="status" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-16">
        <div className="flex min-w-0 flex-col gap-4">
          {heading}
          {text}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

/**
 * Плашка успеха над списком после сохранения (components.md: StatusBanner; 15950:2251, 15966:6274).
 * Объявляется скринридером как статус.
 */
export function StatusBanner({ title, description, action, variant = 'outline', className, children }: StatusBannerProps) {
  const titleId = useId()
  if (variant === 'inverse') return <InverseBanner title={title} action={action} {...(className ? { className } : {})} />
  if (variant === 'accent') return <AccentBanner title={title} action={action} {...(description ? { description } : {})}>{children}</AccentBanner>
  if (variant === 'danger') return <DangerBanner title={title} {...(description ? { description } : {})} {...(className ? { className } : {})} />
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
