import { clsx } from 'clsx'
import { Link } from 'react-router'
import { SCREENS, SERIES_TITLES, samplePath, type ScreenSeries } from '@/app/screens'
import { ROLES } from '@/domain'
import { ROLE_QUERY_PARAM } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'

const SERIES_ORDER: readonly ScreenSeries[] = ['clean', 'first', 'pending']

/** Служебный список всех экранов со ссылками на заглушки — для проверки этапов. */
export function ScreensIndex() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-40 px-40 py-40">
      <h1 className="type-display-lg text-text">{ru.dev.screensTitle}</h1>
      <RoleSwitch />
      {SERIES_ORDER.map((series) => (
        <section key={series} aria-labelledby={`series-${series}`} className="flex flex-col gap-12">
          <h2 id={`series-${series}`} className="type-heading text-text">
            {SERIES_TITLES[series]}
          </h2>
          <table className="w-full border-collapse text-left type-body">
            <thead className="type-overline text-text-muted">
              <tr>
                <th scope="col" className="py-8 pr-16 text-left">{ru.dev.screensColumns.code}</th>
                <th scope="col" className="py-8 text-left">{ru.dev.screensColumns.screen}</th>
                <th scope="col" className="py-8 text-left">{ru.dev.screensColumns.route}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SCREENS.filter((s) => s.series === series).map((s) => (
                <tr key={s.id}>
                  <td className="py-8 pr-16 text-text-secondary">{s.code}</td>
                  <td className="py-8">
                    {s.route === null ? (
                      <span className="text-text-muted">{s.title}</span>
                    ) : (
                      <Link to={samplePath(s.route)} className="rounded-xs text-text underline-offset-4 hover:underline">
                        {s.title}
                      </Link>
                    )}
                  </td>
                  <td className="py-8 text-text-secondary">{s.route ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}

/** Переключатель роли через ?as= — работает в dev-режиме и демо-сборке (D-16). */
function RoleSwitch() {
  const current = useRole()
  return (
    <nav aria-label={ru.dev.switchRole} className="flex items-center gap-12">
      <span className="type-overline text-text-muted">{ru.dev.switchRole}</span>
      {ROLES.map((role) => (
        <Link
          key={role}
          to={`?${ROLE_QUERY_PARAM}=${role}`}
          aria-current={role === current ? 'true' : undefined}
          className={clsx(
            'rounded-full px-16 py-6 type-label',
            role === current ? 'bg-inverse text-on-inverse' : 'bg-bg text-text shadow-raised-sm hover:bg-surface-sunken',
          )}
        >
          {ru.roles[role]}
        </Link>
      ))}
    </nav>
  )
}
