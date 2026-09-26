import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'

interface TextLinkProps extends LinkProps {
  /** Иконка слева: стрелка «назад» вместо текстового «←» (D-03). */
  readonly icon?: LucideIcon
}

/** Ссылка-текст в шапке экрана: «← Процессы» (components.md: TextLink; 15935:906). */
export function TextLink({ icon: Icon, className, children, ...rest }: TextLinkProps) {
  return (
    <Link
      className={clsx(
        'inline-flex items-center gap-4 rounded-xs type-label font-semibold text-text transition-colors hover:text-text-secondary',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden size={16} />}
      {children}
    </Link>
  )
}
