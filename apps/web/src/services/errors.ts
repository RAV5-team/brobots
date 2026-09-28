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

/** Запрос противоречит правилам данных. Текст — для пользователя (ТЗ 4.5.4); поля — если сервис их назвал. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'
  constructor(message: string, readonly fields: readonly FieldIssue[] = []) {
    super(message)
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
