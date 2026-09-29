import { readDemoAccounts, type DemoAccount } from '@/shared/auth/demoAccounts'
import type { KcContext } from './KcContext'

type ThemeContext = Pick<KcContext, 'properties'>

/** Адрес приложения RAV5 (RAV5_APP_URL из docker-compose); без Keycloak (dev-сервер темы) — корень. */
export function appUrl({ properties }: ThemeContext): string {
  return properties.RAV5_APP_URL || '/'
}

/** «Публичный сайт RAV5» (D-28): пока сайта нет — приложение. */
export function publicSiteUrl(context: ThemeContext): string {
  return context.properties.RAV5_PUBLIC_SITE_URL || appUrl(context)
}

/**
 * Демо-учётки жюри (D-16). Плашка есть, только если Keycloak получил и почту, и пароль: docker-compose передаёт
 * их лишь при заданных DEMO_PLATES_*. Отдельного флага нет — пароль в данных страницы и есть решение его показать.
 */
export function demoAccountsOf({ properties }: ThemeContext): readonly DemoAccount[] {
  return readDemoAccounts(
    {
      VITE_DEMO_USER_EMAIL: properties.RAV5_DEMO_USER_EMAIL,
      VITE_DEMO_USER_PASSWORD: properties.RAV5_DEMO_USER_PASSWORD,
      VITE_DEMO_ADMIN_EMAIL: properties.RAV5_DEMO_ADMIN_EMAIL,
      VITE_DEMO_ADMIN_PASSWORD: properties.RAV5_DEMO_ADMIN_PASSWORD,
    },
    true,
  )
}
