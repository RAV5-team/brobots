import { Outlet, useLocation } from 'react-router'
import { ErrorState } from '@/components/ui/States'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'

/**
 * Доступ к разделам по роли на уровне маршрутов (ролевая модель, §3): скрытый пункт меню — не защита, прямая ссылка
 * гостя на форму создания или пользователя на администрирование ведёт на «нет доступа». Данные защищает сервис.
 */
export function RouteGuard() {
  const role = useRole()
  const { pathname } = useLocation()
  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.errors.accessHint} />
  }
  return <Outlet />
}
