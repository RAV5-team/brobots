import { createContext } from 'react'
import type { Role } from '@/domain'

export const RoleContext = createContext<Role | null>(null)

/** Смена роли после входа на экране 05 (D-14, D-24). До Keycloak — запись в sessionStorage. */
export const RoleSwitchContext = createContext<((role: Role) => void) | null>(null)
