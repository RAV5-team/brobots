/** Поле формы, которое не прошло проверку сервиса: `errors[]` ответа API (ТЗ 4.5.4). */
export interface FieldIssue {
  readonly field: string
  readonly message: string
  readonly hint?: string
}

/** Запрошенной сущности нет. Текст — для пользователя (ТЗ 4.5.4). */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError'
}

/** Почта или пароль не подошли. Текст для пользователя берёт экран. */
export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError'
}

/**
 * Какое правило данных нарушено. Экран показывает текст из словаря по причине, а не `message`:
 * `message` — для журнала разработчика (аудит 2026-09-28, §2).
 * `fields` — ошибки полей RFC 7807 от services/api.
 */
export type ValidationReason =
  | { readonly kind: 'compareLimit'; readonly limit: number }
  | { readonly kind: 'robotDuplicate'; readonly robotId: string }
  | { readonly kind: 'refreshNeedsUrl' }
  | { readonly kind: 'dataSourceDuplicate'; readonly name: string }
  | { readonly kind: 'fields'; readonly fields: readonly FieldIssue[] }

/** Запрос противоречит правилам данных (ТЗ 4.5.4). Текст для пользователя — по `reason` из словаря, кроме ошибок полей API. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'
  readonly reason: ValidationReason
  readonly fields: readonly FieldIssue[]

  constructor(reason: ValidationReason, message: string)
  constructor(message: string, fields?: readonly FieldIssue[])
  constructor(reasonOrMessage: ValidationReason | string, messageOrFields?: string | readonly FieldIssue[]) {
    if (typeof reasonOrMessage === 'string') {
      const fields = Array.isArray(messageOrFields) ? messageOrFields : []
      super(reasonOrMessage)
      this.reason = { kind: 'fields', fields }
      this.fields = fields
    } else {
      super(typeof messageOrFields === 'string' ? messageOrFields : '')
      this.reason = reasonOrMessage
      this.fields = reasonOrMessage.kind === 'fields' ? reasonOrMessage.fields : []
    }
  }
}

/**
 * Действие противоречит текущему состоянию: например, шаблон уже на локации. Текст — для пользователя.
 * code — машинный код API (`project_saved`, `evaluation_stale`); у моков его нет.
 */
export class ConflictError extends Error {
  override readonly name = 'ConflictError'
  constructor(message: string, readonly code: string | null = null) {
    super(message)
  }
}

/** Сущность видна, но менять её нельзя: демо-данные, справочник без роли администратора (403). */
export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError'
  constructor(message: string, readonly code: string | null = null) {
    super(message)
  }
}

/** Сессия не принята сервисом (401): нужно войти заново. */
export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError'
}

/** Зависимость сервиса не ответила (503): калькуляция или симуляция. Повторить позже. */
export class UnavailableError extends Error {
  override readonly name = 'UnavailableError'
  constructor(message: string, readonly code: string | null = null) {
    super(message)
  }
}
