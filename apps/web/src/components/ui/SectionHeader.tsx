import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  readonly title: string
  readonly description?: ReactNode
  readonly level?: 2 | 3
  /** id заголовка — для aria-labelledby секции. */
  readonly id?: string
  /** Действия справа: «Все проекты», «+ Добавить». */
  readonly actions?: ReactNode
}

/** Заголовок секции формы или экрана (components.md: Section header; 15935:931). */
export function SectionHeader({ title, description, level = 2, id, actions }: SectionHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    // Без описания заголовок одной строкой — по центру кнопок справа (экран 06, 15935:148); с описанием — по верху.
    <header className={clsx('flex gap-16', description ? 'items-start' : 'items-center')}>
      <div className="flex flex-1 flex-col gap-4">
        <Heading id={id} className="type-heading text-text">{title}</Heading>
        {description && <p className="type-caption text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-8">{actions}</div>}
    </header>
  )
}
