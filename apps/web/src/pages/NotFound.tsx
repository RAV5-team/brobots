import { Link } from 'react-router'
import { DEV_PATHS } from '@/app/routePaths'
import { ru } from '@/shared/i18n/ru'

export function NotFound() {
  return (
    <article className="flex flex-col gap-16">
      <h1 className="type-display-lg text-text">{ru.errors.notFoundTitle}</h1>
      <Link to={DEV_PATHS.screens} className="rounded-xs text-text underline underline-offset-4 hover:text-text-secondary">
        {ru.stub.allScreens}
      </Link>
    </article>
  )
}
