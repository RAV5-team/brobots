import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ErrorState } from '@/components/ui/States'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'

/** Раздел «Администрирование» ведёт только администратор (PRD 5.3, 6): остальным — «нет доступа» вместо экрана. */
export function AdminGuard({ children }: { readonly children: ReactNode }) {
  const role = useRole()
  const { pathname } = useLocation()
  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.admin.accessHint} />
  }
  return children
}
