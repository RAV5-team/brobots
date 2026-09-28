import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { Link, type LinkProps } from 'react-router'

interface BridgeProps {
  readonly className?: string
}

/** Вогнутая перемычка 19×44 между капсулой и кругом («merged › bridge»): заходит на обе фигуры, как в макете. */
export function Bridge({ className }: BridgeProps) {
  return (
    <svg aria-hidden viewBox="0 0 19 44" className={clsx('-mx-6 h-44 w-auto shrink-0', className)}>
      <path d="M0 6.633A12 12 0 0 0 19 7.937V36.063A12 12 0 0 0 0 37.367Z" />
    </svg>
  )
}

interface MergedButtonLinkProps extends Omit<LinkProps, 'children'> {
  readonly label: string
  readonly icon: LucideIcon
}

/**
 * Главное действие экрана: тёмная капсула и круг с иконкой, слитые перемычкой
 * (components.md: MergedButton; 15935:283 «Создать новый процесс +»). Наведение — все три части на шаг светлее (D-02).
 */
export function MergedButtonLink({ label, icon: Icon, className, ...rest }: MergedButtonLinkProps) {
  const part = 'bg-inverse transition-colors group-hover:bg-inverse-hover'
  return (
    <Link className={clsx('group flex h-44 shrink-0 rounded-full drop-shadow-popover', className)} {...rest}>
      <span className={clsx('flex items-center rounded-full px-20 type-body font-semibold whitespace-nowrap text-on-inverse', part)}>
        {label}
      </span>
      <Bridge className="fill-inverse transition-colors group-hover:fill-inverse-hover" />
      <span className={clsx('flex size-44 shrink-0 items-center justify-center rounded-full text-on-inverse', part)}>
        <Icon aria-hidden size={16} strokeWidth={2.5} />
      </span>
    </Link>
  )
}

interface MergedButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly label: string
  readonly icon: LucideIcon
  /** На всю ширину колонки: капсула растягивается, круг остаётся справа (09а «Сохранить процесс →», 15935:1270). */
  readonly block?: boolean
  /** Возврат фокуса после окна, открытого этой кнопкой (А7). */
  readonly ref?: Ref<HTMLButtonElement>
}

/**
 * То же главное действие, но кнопкой: отправка формы, сохранение (components.md: MergedButton).
 * Неактивная — светлая, без тени: заливка sunken, текст и иконка muted («merged · disabled», 16429:79).
 */
export function MergedButton({ label, icon: Icon, block = false, className, type = 'button', ...rest }: MergedButtonProps) {
  const part = 'bg-inverse text-on-inverse transition-colors group-enabled:group-hover:bg-inverse-hover group-disabled:bg-surface-sunken group-disabled:text-text-muted'
  return (
    <button
      type={type}
      className={clsx(
        'group flex h-44 shrink-0 rounded-full not-disabled:drop-shadow-popover disabled:cursor-not-allowed',
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      <span className={clsx('flex h-44 items-center rounded-full px-20 type-body font-semibold whitespace-nowrap', block && 'flex-1', part)}>
        {label}
      </span>
      <Bridge className="fill-inverse transition-colors group-enabled:group-hover:fill-inverse-hover group-disabled:fill-surface-sunken" />
      <span className={clsx('flex size-44 shrink-0 items-center justify-center rounded-full', part)}>
        <Icon aria-hidden size={16} strokeWidth={2.5} />
      </span>
    </button>
  )
}
