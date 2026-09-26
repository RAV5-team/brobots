import { useContext } from 'react'
import type { Role } from '@/domain'
import { RoleSwitchContext } from './roleContext'

export function useSwitchRole(): (role: Role) => void {
  const switchRole = useContext(RoleSwitchContext)
  if (switchRole === null) throw new Error('useSwitchRole вызван вне RoleProvider')
  return switchRole
}
