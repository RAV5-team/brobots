import type { ExtendKcContext } from 'keycloakify/login'
import type { KcEnvName, ThemeName } from '../kc.gen'

export interface KcContextExtension {
  themeName: ThemeName
  /** Переменные окружения Keycloak из vite.config.ts (THEME_ENV). */
  properties: Record<KcEnvName, string>
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- страницам пока нечего добавлять к контексту
export type KcContextExtensionPerPage = {}

export type KcContext = ExtendKcContext<KcContextExtension, KcContextExtensionPerPage>

/** Контекст одной страницы: `PageContext<'login.ftl'>`. */
export type PageContext<PageId extends KcContext['pageId']> = Extract<KcContext, { pageId: PageId }>
