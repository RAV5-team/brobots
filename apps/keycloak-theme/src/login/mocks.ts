import { createGetKcContextMock } from 'keycloakify/login/KcContext'
import { kcEnvDefaults, themeNames } from '../kc.gen'
import type { KcContext, KcContextExtension, KcContextExtensionPerPage } from './KcContext'

const [themeName = 'rav5'] = themeNames

const kcContextExtension: KcContextExtension = { themeName, properties: { ...kcEnvDefaults } }
const kcContextExtensionPerPage: KcContextExtensionPerPage = {}

/** Контекст страницы без Keycloak: dev-сервер темы и тесты. */
export const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension,
  kcContextExtensionPerPage,
  // Как realm-rav5.json: русский по умолчанию, почта — логин.
  overrides: { locale: { currentLanguageTag: 'ru' }, realm: { registrationEmailAsUsername: true } },
  overridesPerPage: {},
})

/** Демо-учётки как на стенде жюри (DEMO_PLATES_* в .env); значения — как в макете 05 (15935:78). */
export const DEMO_PROPERTIES = {
  RAV5_DEMO_USER_EMAIL: 'demo@rav5.ru',
  RAV5_DEMO_USER_PASSWORD: 'demo2026',
  RAV5_DEMO_ADMIN_EMAIL: 'admin@rav5.ru',
  RAV5_DEMO_ADMIN_PASSWORD: 'admin2026',
} as const

/**
 * ?page=register.ftl — страница, ?demo=1 — плашки демо-учёток, ?error=1 — неверный пароль на экране входа,
 * ?figma=1 — экран входа как в макете 05 (15935:17): без «Запомнить меня» и регистрации, которые включает realm.
 */
export function mockFromSearch(search: string): KcContext {
  const params = new URLSearchParams(search)
  const pageId = (params.get('page') ?? 'login.ftl') as KcContext['pageId']
  const properties = params.has('demo') ? DEMO_PROPERTIES : {}
  if (pageId === 'login.ftl' && params.has('figma')) {
    return getKcContextMock({ pageId, overrides: { properties, realm: { rememberMe: false, registrationAllowed: false } } })
  }
  if (pageId === 'login.ftl' && params.has('error')) {
    return getKcContextMock({
      pageId,
      overrides: {
        properties,
        login: { username: 'user@example.com' },
        messagesPerField: {
          existsError: (...fields: string[]) => fields.includes('username') || fields.includes('password'),
          getFirstError: () => 'Неверное имя пользователя или пароль.',
        },
      },
    })
  }
  return getKcContextMock({ pageId, overrides: { properties } })
}
