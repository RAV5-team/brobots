import type { PageContext } from './KcContext'

type RegisterContext = PageContext<'register.ftl'>
export type ProfileAttribute = RegisterContext['profile']['attributesByName'][string]

/** Атрибуты профиля для формы регистрации: логин совпадает с почтой (registrationEmailAsUsername) — его поля нет. */
export function formAttributes({ profile, realm }: RegisterContext): readonly ProfileAttribute[] {
  return Object.values(profile.attributesByName).filter(
    (attribute) => !attribute.readOnly && !(attribute.name === 'username' && realm.registrationEmailAsUsername),
  )
}

/** Поле, которое тема рисует обычным текстовым вводом: без списка значений и без особого типа ввода. */
function isPlainAttribute(attribute: ProfileAttribute): boolean {
  return attribute.multivalued !== true && attribute.annotations.inputType === undefined && attribute.validators.options === undefined
}

/**
 * Вход, который тема rav5 рисует сама: пароль без внешних провайдеров и ключей доступа (passkeys).
 * Включат их в realm — страница уйдёт на стандартную keycloakify, а не потеряет кнопки молча.
 */
export function isSupportedLogin(context: PageContext<'login.ftl'>): boolean {
  return context.realm.password && (context.social?.providers?.length ?? 0) === 0 && context.enableWebAuthnConditionalUI !== true
}

/** Регистрация, которую тема rav5 рисует сама: без согласия с условиями, reCAPTCHA и сложных полей профиля. */
export function isSupportedRegistration(context: RegisterContext): boolean {
  return context.termsAcceptanceRequired !== true && context.recaptchaRequired !== true && formAttributes(context).every(isPlainAttribute)
}
