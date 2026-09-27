import type { Role } from '@/domain'
import { DEMO_MODE } from './demoMode'

/** Демо-учётка жюри (ТЗ 8.2.5; PRD 4). Роли с кабинетом — пользователь и администратор. */
export interface DemoAccount {
  readonly role: Extract<Role, 'user' | 'admin'>
  readonly email: string
  readonly password: string
}

type Env = Readonly<Record<string, string | undefined>>

const ENV_KEYS: readonly { role: DemoAccount['role']; email: string; password: string }[] = [
  { role: 'user', email: 'VITE_DEMO_USER_EMAIL', password: 'VITE_DEMO_USER_PASSWORD' },
  { role: 'admin', email: 'VITE_DEMO_ADMIN_EMAIL', password: 'VITE_DEMO_ADMIN_PASSWORD' },
]

/**
 * Демо-учётки из переменных окружения (D-16): только в демо-сборке и только полностью заданные.
 * Логинов и паролей в коде нет — они попадают в бандл лишь при VITE_DEMO_MODE=true.
 */
export function readDemoAccounts(env: Env, demoMode: boolean): readonly DemoAccount[] {
  if (!demoMode) return []
  return ENV_KEYS.flatMap(({ role, email, password }) => {
    const emailValue = env[email]?.trim()
    const passwordValue = env[password]
    return emailValue && passwordValue ? [{ role, email: emailValue, password: passwordValue }] : []
  })
}

const { VITE_DEMO_USER_EMAIL, VITE_DEMO_USER_PASSWORD, VITE_DEMO_ADMIN_EMAIL, VITE_DEMO_ADMIN_PASSWORD } = import.meta.env

export const DEMO_ACCOUNTS: readonly DemoAccount[] = readDemoAccounts(
  { VITE_DEMO_USER_EMAIL, VITE_DEMO_USER_PASSWORD, VITE_DEMO_ADMIN_EMAIL, VITE_DEMO_ADMIN_PASSWORD },
  DEMO_MODE,
)
