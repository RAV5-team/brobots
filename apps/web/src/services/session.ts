import type { DataVersion, Profile, Role } from '@/domain'

/** Сессия: профиль и действующие версии данных. Роль приходит из авторизации (пока — D-24). */
export interface Credentials {
  readonly email: string
  readonly password: string
}

export interface SessionService {
  /** Вход в рабочий кабинет (экран 05). Неверная пара → InvalidCredentialsError. */
  signIn(credentials: Credentials): Promise<Profile>
  getProfile(role: Role): Promise<Profile>
  getDataVersion(): Promise<DataVersion>
}
