import DefaultPage from 'keycloakify/login/DefaultPage'
import DefaultTemplate from 'keycloakify/login/Template'
import { lazy, Suspense } from 'react'
import { useI18n } from './i18n'
import type { KcContext } from './KcContext'
import { ErrorPage } from './pages/ErrorPage'
import { Info } from './pages/Info'
import { Login } from './pages/Login'
import { LoginPageExpired } from './pages/LoginPageExpired'
import { LoginUpdatePassword } from './pages/LoginUpdatePassword'
import { LogoutConfirm } from './pages/LogoutConfirm'
import { Register } from './pages/Register'
import { isSupportedLogin, isSupportedRegistration } from './pageSupport'

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'))

/**
 * Страницы темы rav5. Свёрстаны на UI-kit RAV5 только те, что встречаются в нашем realm; остальные (OTP, привязка IdP
 * и т. п.), а также вход и регистрация с возможностями, которых тема не рисует (pageSupport.ts), — стандартные
 * страницы keycloakify со стилями Keycloak.
 */
export default function KcPage({ kcContext }: { readonly kcContext: KcContext }) {
  const { i18n } = useI18n({ kcContext })

  switch (kcContext.pageId) {
    case 'login.ftl':
      if (isSupportedLogin(kcContext)) return <Login kcContext={kcContext} />
      break
    case 'register.ftl':
      if (isSupportedRegistration(kcContext)) return <Register kcContext={kcContext} i18n={i18n} />
      break
    case 'info.ftl':
      return <Info kcContext={kcContext} i18n={i18n} />
    case 'error.ftl':
      return <ErrorPage kcContext={kcContext} />
    case 'login-page-expired.ftl':
      return <LoginPageExpired kcContext={kcContext} />
    case 'logout-confirm.ftl':
      return <LogoutConfirm kcContext={kcContext} />
    case 'login-update-password.ftl':
      return <LoginUpdatePassword kcContext={kcContext} />
  }

  return (
    <Suspense>
      <DefaultPage
        kcContext={kcContext}
        i18n={i18n}
        Template={DefaultTemplate}
        doUseDefaultCss
        UserProfileFormFields={UserProfileFormFields}
        doMakeUserConfirmPassword
      />
    </Suspense>
  )
}
