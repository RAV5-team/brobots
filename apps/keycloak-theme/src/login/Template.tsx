import { useEffect, type ReactNode } from 'react'
import { StatusBanner, type StatusBannerVariant } from '@/components/ui/StatusBanner'
import { LoginLayout } from '@/pages/login/LoginLayout'
import type { KcContext } from './KcContext'
import { publicSiteUrl } from './themeLinks'

type MessageType = NonNullable<KcContext['message']>['type']

/** Сообщение Keycloak над формой: ошибка — красная плашка, успех — с галочкой, остальное — лаймовая. */
const MESSAGE_VARIANTS: Record<MessageType, StatusBannerVariant> = {
  error: 'danger',
  warning: 'accent',
  info: 'accent',
  success: 'outline',
}

interface TemplateProps {
  readonly kcContext: KcContext
  readonly title: string
  readonly documentTitle?: string
  /** false — страница сама показывает ошибку у поля (неверный пароль у формы входа). */
  readonly displayMessage?: boolean
  readonly children: ReactNode
}

/** Каркас страниц входа — тот же, что у экрана 05 в SPA (LoginLayout), плюс сообщение Keycloak над содержимым. */
export function Template({ kcContext, title, documentTitle = title, displayMessage = true, children }: TemplateProps) {
  const { message, isAppInitiatedAction } = kcContext
  // Предупреждение в действии, начатом приложением, Keycloak показывает только в самой форме.
  const shownMessage = displayMessage && message && (message.type !== 'warning' || !isAppInitiatedAction) ? message : undefined

  useEffect(() => {
    document.title = documentTitle
  }, [documentTitle])

  return (
    <LoginLayout title={title} publicSiteUrl={publicSiteUrl(kcContext)}>
      {shownMessage && <StatusBanner variant={MESSAGE_VARIANTS[shownMessage.type]} title={shownMessage.summary} />}
      {children}
    </LoginLayout>
  )
}
