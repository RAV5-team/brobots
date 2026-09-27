import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

interface TextLinkProps extends LinkProps {
  /** Иконка слева: стрелка «назад» вместо текстового «←» (D-03). */
  readonly icon?: LucideIcon
}

/** default — 14 SemiBold (15935:906); subtle — 13 Medium приглушённым цветом: «Сбросить» у фильтров К-2 (16642:2320). */
export type TextActionVariant = 'default' | 'subtle'

const VARIANTS: Record<TextActionVariant, string> = {
  default: 'type-label font-semibold text-text hover:text-text-secondary',
  subtle: 'type-body-sm font-medium text-text-muted hover:text-text',
}

const textLinkClasses = (className?: string, variant: TextActionVariant = 'default') =>
  clsx(
    'inline-flex items-center gap-4 rounded-xs transition-colors',
    VARIANTS[variant],
    'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
    className,
  )

/** Ссылка-текст в шапке экрана: «← Процессы» (components.md: TextLink; 15935:906). */
export function TextLink({ icon: Icon, className, children, ...rest }: TextLinkProps) {
  return (
    <Link className={textLinkClasses(className)} {...rest}>
      {Icon && <Icon aria-hidden size={16} />}
      {children}
    </Link>
  )
}

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Иконка слева: «+» вместо текстового символа (D-03). */
  readonly icon?: LucideIcon
  readonly variant?: TextActionVariant
}

/** То же текстовое действие, но кнопкой: «+ Добавить группу персонала» (15950:2130). */
export function TextButton({ icon: Icon, className, children, type = 'button', variant, ...rest }: TextButtonProps) {
  return (
    <button type={type} className={textLinkClasses(className, variant)} {...rest}>
      {Icon && <Icon aria-hidden size={16} />}
      {children}
    </button>
  )
}
