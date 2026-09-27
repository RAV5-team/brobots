import { useContext } from 'react'
import type { Role } from '@/domain'
import { RoleContext } from './roleContext'

export function useRole(): Role {
  const role = useContext(RoleContext)
  if (role === null) throw new Error('useRole вызван вне RoleProvider')
  return role
}
