import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Role } from '@/domain'
import { useLocation } from 'react-router'
import { ALLOW_URL_ROLE, FALLBACK_ROLE, ROLE_STORAGE_KEY } from './demoMode'
import { resolveRole } from './resolveRole'
import { RoleContext, RoleSwitchContext } from './roleContext'

// sessionStorage может быть недоступен (приватный режим, запрет cookies) — тогда роль живёт только в URL.
function readStoredRole(): string | null {
  try {
    return sessionStorage.getItem(ROLE_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeRole(role: string): void {
  try {
    sessionStorage.setItem(ROLE_STORAGE_KEY, role)
  } catch {
    // Без хранилища роль держится, пока ?as= есть в адресе.
  }
}

/**
 * Роль сессии: ?as= (dev и демо) → sessionStorage → роль по умолчанию (D-14, D-16, D-24).
 * Вход на экране 05 записывает роль в sessionStorage; вне dev и демо-сборки она не читается — до Keycloak там только гость.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { search } = useLocation()
  // Счётчик заставляет перечитать sessionStorage после входа, даже если адрес не изменился.
  const [, setRevision] = useState(0)
  const switchRole = useCallback((next: Role) => {
    storeRole(next)
    setRevision((n) => n + 1)
  }, [])
  const { role, persist } = resolveRole({
    search,
    stored: readStoredRole(),
    allowUrlRole: ALLOW_URL_ROLE,
    fallback: FALLBACK_ROLE,
  })

  useEffect(() => {
    if (persist) storeRole(persist)
  }, [persist])

  return (
    <RoleSwitchContext value={switchRole}>
      <RoleContext value={role}>{children}</RoleContext>
    </RoleSwitchContext>
  )
}
