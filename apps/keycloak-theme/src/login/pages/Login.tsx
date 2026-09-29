import { DemoOfferCard } from '@/pages/login/DemoOfferCard'
import { LoginCards } from '@/pages/login/LoginLayout'
import { ru } from '@/shared/i18n/ru'
import type { PageContext } from '../KcContext'
import { Template } from '../Template'
import { appUrl, demoAccountsOf } from '../themeLinks'
import { KcSignInCard } from './KcSignInCard'

/** Экран 05 «Вход · авторизация» в теме Keycloak (PRD 4; 15935:17): демо слева, вход в кабинет справа. */
export function Login({ kcContext }: { readonly kcContext: PageContext<'login.ftl'> }) {
  return (
    <Template
      kcContext={kcContext}
      title={ru.login.title}
      documentTitle={ru.login.documentTitle}
      displayMessage={!kcContext.messagesPerField.existsError('username', 'password')}
    >
      <LoginCards>
        {/* Без входа приложение открывается гостем (D-24): демо — просто переход в RAV5. */}
        <DemoOfferCard openDemoHref={appUrl(kcContext)} />
        <KcSignInCard kcContext={kcContext} demoAccounts={demoAccountsOf(kcContext)} />
      </LoginCards>
    </Template>
  )
}
