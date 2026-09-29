import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  readonly title: ReactNode
  /** Подзаголовок под заголовком; нет — только заголовок. */
  readonly lead?: ReactNode
  /** Зазор заголовка и подзаголовка: 4 — списки и разделы (06, 12, К-1, администрирование 15966:8020), 8 — формы (09а, А2) и 07. */
  readonly gap?: 4 | 8
  /** Действия справа, по нижнему краю текста: «Очистить» (К-3). */
  readonly actions?: ReactNode
}

const GAPS = { 4: 'gap-4', 8: 'gap-8' } as const

/** Шапка страницы: заголовок `h1` и подзаголовок (components.md: PageHeader). */
export function PageHeader({ title, lead, gap = 4, actions }: PageHeaderProps) {
  const text = (
    <>
      <h1 className="type-display-lg text-text">{title}</h1>
      {lead !== undefined && <p className="type-body text-text-secondary">{lead}</p>}
    </>
  )
  if (actions === undefined) return <header className={clsx('flex flex-col', GAPS[gap])}>{text}</header>
  return (
    <header className="flex items-end justify-between gap-16">
      <div className={clsx('flex flex-col', GAPS[gap])}>{text}</div>
      {actions}
    </header>
  )
}
