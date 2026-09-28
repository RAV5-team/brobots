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
 */
export type ValidationReason =
  | { readonly kind: 'compareLimit'; readonly limit: number }
  | { readonly kind: 'robotDuplicate'; readonly robotId: string }
  | { readonly kind: 'refreshNeedsUrl' }
  | { readonly kind: 'dataSourceDuplicate'; readonly name: string }

/** Запрос противоречит правилам данных (ТЗ 4.5.4). Текст для пользователя — по `reason` из словаря. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'

  constructor(readonly reason: ValidationReason, message: string) {
    super(message)
  }
}

/** Действие противоречит текущему состоянию: например, шаблон уже на локации. Текст — для пользователя. */
export class ConflictError extends Error {
  override readonly name = 'ConflictError'
}
