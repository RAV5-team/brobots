import type { Role } from './role'

/** Кто вошёл: блок пользователя и меню кабинета (PRD 5.1, 5.2). Гость — без имени и почты. */
export interface Profile {
  readonly role: Role
  readonly name: string
  readonly initials: string
  readonly email: string | null
  readonly organization: string | null
}

/** Версии каталога и расчётной модели — для воспроизводимости расчёта (ТЗ 3.1.5). */
export interface DataVersion {
  /** Чьи данные: «ФЦ БАС». */
  readonly source: string
  readonly catalog: string
  readonly model: string
  /** Дата снимка данных, YYYY-MM-DD. */
  readonly snapshotDate: string
}
