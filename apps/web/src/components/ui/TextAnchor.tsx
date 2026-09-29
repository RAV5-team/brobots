import type { LucideIcon } from 'lucide-react'
import type { AnchorHTMLAttributes } from 'react'
import { textLinkClasses, type TextActionVariant } from './textLinkStyles'

interface TextAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string
  readonly icon?: LucideIcon
  readonly variant?: TextActionVariant
}

/**
 * Текстовая ссылка обычным `<a>` — вне роутера SPA: страницы темы входа Keycloak, внешние адреса.
 * Выглядит как TextLink (15935:906).
 */
export function TextAnchor({ icon: Icon, variant, className, children, ...rest }: TextAnchorProps) {
  return (
    <a className={textLinkClasses(className, variant)} {...rest}>
      {Icon && <Icon aria-hidden size={16} />}
      {children}
    </a>
  )
}
