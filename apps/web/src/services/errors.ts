/** Запрошенной сущности нет. Текст — для пользователя (ТЗ 4.5.4). */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError'
}

/** Почта или пароль не подошли. Текст для пользователя берёт экран. */
export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError'
}

/** Запрос противоречит правилам данных. Текст — для пользователя (ТЗ 4.5.4). */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'
}

/** Действие противоречит текущему состоянию: например, шаблон уже на локации. Текст — для пользователя. */
export class ConflictError extends Error {
  override readonly name = 'ConflictError'
}
