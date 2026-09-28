import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Card } from './Card'
import { SectionHeader } from './SectionHeader'

interface FormSectionProps {
  /** Якорь для SectionNav. */
  readonly id: string
  readonly title: string
  readonly description?: string | undefined
  readonly children: ReactNode
}

/**
 * Секция длинной формы: выпуклая панель 28 / 20 с заголовком (components.md: FormSection; 09а 15935:1008, 14 15950:1975).
 * Цель якоря SectionNav: фокусируется при переходе и не прячется под липкой навигацией.
 */
export function FormSection({ id, title, description, children }: FormSectionProps) {
  const headingId = `${id}-heading`
  return (
    <Card id={id} padding={28} gap={20} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-(--rav-form-nav-offset) outline-none">
      <SectionHeader id={headingId} title={title} description={description} />
      {children}
    </Card>
  )
}

// Классы целиком: Tailwind находит утилиты только по полным строкам.
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const

/**
 * Сетка полей: 20 по вертикали, 16 между колонками (15935:1012, 15950:1980).
 * По умолчанию две колонки; три и четыре — условия симуляции 05 (16197:1286).
 */
export function FieldGrid({ columns = 2, children }: { readonly columns?: keyof typeof COLUMNS; readonly children: ReactNode }) {
  return <div className={clsx('grid items-start gap-x-16 gap-y-20', COLUMNS[columns])}>{children}</div>
}
