import type { LucideIcon } from 'lucide-react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { ICON_SIZES, iconButtonClasses, type IconButtonSize, type IconButtonTone, type IconButtonVariant } from './iconButtonStyles'

interface IconButtonLook {
  /** Доступное имя: у кнопки нет текста. */
  readonly label: string
  readonly icon: LucideIcon
  /** 44 — строки списков (15935:159), 36 — таблицы и карточки (15997:301), 24 — внутри строк панели и таблиц (15950:2172). */
  readonly size?: IconButtonSize
  /** raised — выпуклый круг; ghost — только иконка приглушённым цветом («×» удаления строки, 15950:2106). */
  readonly variant?: IconButtonVariant
  /** danger — красная иконка на выпуклом круге: «→» к полю с ошибкой (15950:2172). */
  readonly tone?: IconButtonTone
}

type IconButtonProps = IconButtonLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/** Круглая кнопка-иконка: «открыть», «изменить», «+». Иконки — lucide-react (D-03). */
export function IconButton({ label, icon: Icon, size = 44, variant = 'raised', tone = 'default', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={iconButtonClasses(size, variant, tone, className)} {...rest}>
      <Icon aria-hidden size={ICON_SIZES[size]} />
    </button>
  )
}

type IconButtonLinkProps = IconButtonLook & Omit<LinkProps, 'children'>

/** Та же круглая кнопка, но переход по ссылке: «→» в строке проекта (экран 06). */
export function IconButtonLink({ label, icon: Icon, size = 44, variant = 'raised', tone = 'default', className, ...rest }: IconButtonLinkProps) {
  return (
    <Link aria-label={label} title={label} className={iconButtonClasses(size, variant, tone, className)} {...rest}>
      <Icon aria-hidden size={ICON_SIZES[size]} />
    </Link>
  )
}

type IconButtonAnchorProps = IconButtonLook & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { readonly href: string }

/** Та же круглая кнопка, но обычная ссылка вне приложения: открыть файл документа в новой вкладке (17б, 16013:2). */
export function IconButtonAnchor({ label, icon: Icon, size = 44, variant = 'raised', tone = 'default', className, ...rest }: IconButtonAnchorProps) {
  return (
    <a target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={iconButtonClasses(size, variant, tone, className)} {...rest}>
      <Icon aria-hidden size={ICON_SIZES[size]} />
    </a>
  )
}
