import { clsx } from 'clsx'
import { CircleAlert, Inbox } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'
import { Button } from './Button'

interface EmptyStateProps {
  readonly title: string
  readonly description?: string
  /** Следующий шаг: «Добавить процесс». */
  readonly action?: ReactNode
  /**
   * md — вдавленная плашка внутри раздела (ничего не найдено по фильтру);
   * lg — выпуклая панель на месте всего списка, когда в разделе ещё ничего нет (15919:552, D-40).
   */
  readonly size?: 'md' | 'lg'
}

/** Пустой список или раздел (D-07). Всегда подсказывает следующий шаг. */
export function EmptyState({ title, description, action, size = 'md' }: EmptyStateProps) {
  if (size === 'lg') {
    return (
      <section className="flex min-h-(--rav-empty-panel-min-height) flex-col items-center justify-center gap-12 rounded-2xl bg-bg px-(--rav-empty-panel-pad-x) py-(--rav-empty-panel-pad-y) text-center shadow-raised-md">
        <h2 className="type-title-lg text-text">{title}</h2>
        {description && <p className="type-title-sm font-normal text-text-secondary">{description}</p>}
        {action && <div className="pt-12">{action}</div>}
      </section>
    )
  }
  return (
    <section className="flex flex-col items-center gap-12 rounded-2xl bg-surface-muted p-40 text-center shadow-inset-md">
      <Inbox aria-hidden size={20} className="text-text-muted" />
      <h2 className="type-heading text-text">{title}</h2>
      {description && <p className="type-body text-text-secondary">{description}</p>}
      {action}
    </section>
  )
}

interface ErrorStateProps {
  readonly title: string
  /** Что случилось и как исправить (ТЗ 4.5.4). */
  readonly message: string
  readonly onRetry?: () => void
}

/** Ошибка загрузки данных (D-07). Сохранённые данные не теряются — показываем способ повторить. */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <section role="alert" className="flex flex-col items-start gap-12 rounded-2xl border border-danger-border bg-danger-bg p-28">
      <div className="flex items-center gap-8 text-danger">
        <CircleAlert aria-hidden size={20} />
        <h2 className="type-heading">{title}</h2>
      </div>
      <p className="type-body text-text">{message}</p>
      {onRetry && <Button onClick={onRetry}>{ru.ui.retry}</Button>}
    </section>
  )
}

/** Заглушка на время загрузки (D-07). Мигание — только если пользователь не отключил анимацию. */
export function Skeleton({ className, style }: { readonly className?: string; readonly style?: CSSProperties }) {
  return <div aria-hidden="true" className={clsx('rounded-md bg-surface-sunken motion-safe:animate-pulse', className)} style={style} />
}
