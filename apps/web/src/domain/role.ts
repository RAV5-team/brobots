/** Роли платформы (PRD 4; D-14). */
export const ROLES = ['guest', 'user', 'admin'] as const

export type Role = (typeof ROLES)[number]

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value)
