import type { ButtonHTMLAttributes, Ref } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonStyle } from './buttonStyles'

type ButtonProps = ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement> & { readonly ref?: Ref<HTMLButtonElement> }

/** Кнопка (components.md: Button). По умолчанию type="button", чтобы не отправлять форму случайно. */
export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...rest} />
}

type ButtonLinkProps = ButtonStyle & LinkProps

/** Ссылка, которая выглядит как кнопка: «Все проекты», «Открыть в каталоге». */
export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size }, className)} {...rest} />
}
