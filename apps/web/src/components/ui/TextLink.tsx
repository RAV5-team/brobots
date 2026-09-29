import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { textLinkClasses, type TextActionVariant } from './textLinkStyles'

interface TextLinkProps extends LinkProps {
  /** Иконка слева: стрелка «назад» вместо текстового «←» (D-03). */
  readonly icon?: LucideIcon
}

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
