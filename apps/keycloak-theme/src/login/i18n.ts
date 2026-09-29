import { i18nBuilder } from 'keycloakify/login'
import type { ThemeName } from '../kc.gen'

/** Сообщения Keycloak (ошибки полей, требуемые действия) и страницы по умолчанию. Свои тексты — в ru.ts apps/web. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ofTypeI18n нужен только ради типа I18n
const { useI18n, ofTypeI18n } = i18nBuilder.withThemeName<ThemeName>().build()

type I18n = typeof ofTypeI18n

export { useI18n, type I18n }
