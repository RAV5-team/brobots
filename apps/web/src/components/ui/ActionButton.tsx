import { clsx } from 'clsx'
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'

export type ActionButtonTone = 'default' | 'strong'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default — светлый круг со стрелкой («Открыть демо»); strong — тёмный круг и полужирная подпись («Войти»). */
  readonly tone?: ActionButtonTone
  readonly icon?: LucideIcon
  readonly children: ReactNode
  readonly ref?: Ref<HTMLButtonElement>
}

const CIRCLE: Record<ActionButtonTone, string> = {
  default: 'bg-bg text-text shadow-raised-sm',
  strong: 'bg-inverse text-on-inverse drop-shadow-popover group-hover:bg-inverse-hover group-disabled:bg-inverse',
}

/**
 * Кнопка-капсула на всю ширину: подпись слева, круг 48 со стрелкой справа (components.md: ActionButton; 15935:68, 15935:101).
 * Состояния по D-02: наведение — фон на шаг темнее, нажатие — выпуклая тень меняется на вдавленную.
 */
export function ActionButton({ tone = 'default', icon, className, type = 'button', children, ...rest }: ActionButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        ACTION_CAPSULE,
        'not-disabled:hover:bg-surface-muted not-disabled:active:shadow-inset-sm',
        'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
        className,
      )}
      {...rest}
    >
      <ActionContent tone={tone} icon={icon}>{children}</ActionContent>
    </button>
  )
}

interface ActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string
  readonly tone?: ActionButtonTone
  readonly icon?: LucideIcon
  readonly children: ReactNode
}

/** Та же капсула ссылкой — переход на другой адрес («Продолжить», «Начать вход заново» в теме входа Keycloak). */
export function ActionLink({ tone = 'default', icon, className, children, ...rest }: ActionLinkProps) {
  return (
    <a className={clsx(ACTION_CAPSULE, 'hover:bg-surface-muted active:shadow-inset-sm', className)} {...rest}>
      <ActionContent tone={tone} icon={icon}>{children}</ActionContent>
    </a>
  )
}

const ACTION_CAPSULE = clsx(
  'group flex w-full items-center justify-between gap-12 rounded-full bg-bg ring-1 ring-highlight ring-inset py-8 pr-24 pl-28 text-text shadow-raised-md',
  'transition-[background-color,box-shadow]',
)

function ActionContent({ tone, icon: Icon = ArrowRight, children }: { readonly tone: ActionButtonTone; readonly icon: LucideIcon | undefined; readonly children: ReactNode }) {
  return (
    <>
      <span className={clsx('type-heading', tone === 'strong' ? 'font-semibold' : 'font-medium')}>{children}</span>
      <span aria-hidden className={clsx('flex size-48 shrink-0 items-center justify-center rounded-full transition-colors', CIRCLE[tone])}>
        <Icon size={16} />
      </span>
    </>
  )
}

interface BackLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string
  readonly children: ReactNode
}

/** Ссылка-капсула «назад»: вдавленный круг со стрелкой слева и подпись («Публичный сайт RAV5», 15935:19). */
export function BackLink({ className, children, ...rest }: BackLinkProps) {
  return (
    <a
      className={clsx(
        'inline-flex items-center gap-12 rounded-full bg-bg ring-1 ring-highlight ring-inset py-8 pr-20 pl-8 text-text shadow-raised-md',
        'transition-[background-color,box-shadow] hover:bg-surface-muted active:shadow-inset-sm',
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="flex size-32 shrink-0 items-center justify-center rounded-full bg-bg shadow-inset-md">
        <ArrowLeft size={16} />
      </span>
      <span className="type-body font-medium">{children}</span>
    </a>
  )
}
