import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

type IconButtonSize = 36 | 44

interface IconButtonLook {
  /** Доступное имя: у кнопки нет текста. */
  readonly label: string
  readonly icon: LucideIcon
  /** 44 — строки списков (15935:159), 36 — таблицы и карточки (15997:301). */
  readonly size?: IconButtonSize
}

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-bg text-text shadow-raised-sm transition-[background-color,box-shadow] ' +
  'not-disabled:hover:bg-surface-muted not-disabled:active:shadow-inset-sm disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)'

const iconButtonClasses = (size: IconButtonSize, className?: string) => clsx(BASE, size === 44 ? 'size-44' : 'size-36', className)

type IconButtonProps = IconButtonLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/** Круглая кнопка-иконка: «открыть», «изменить», «+». Иконки — lucide-react (D-03). */
export function IconButton({ label, icon: Icon, size = 44, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={iconButtonClasses(size, className)} {...rest}>
      <Icon aria-hidden size={16} />
    </button>
  )
}

type IconButtonLinkProps = IconButtonLook & Omit<LinkProps, 'children'>

/** Та же круглая кнопка, но переход по ссылке: «→» в строке проекта (экран 06). */
export function IconButtonLink({ label, icon: Icon, size = 44, className, ...rest }: IconButtonLinkProps) {
  return (
    <Link aria-label={label} title={label} className={iconButtonClasses(size, className)} {...rest}>
      <Icon aria-hidden size={16} />
    </Link>
  )
}
