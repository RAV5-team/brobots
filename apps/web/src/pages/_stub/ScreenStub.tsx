import { ExternalLink } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { DEV_PATHS, type RoutePath } from '@/app/routePaths'
import { SERIES_TITLES, figmaUrl, screensByRoute, type Screen } from '@/app/screens'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'

interface ScreenStubProps {
  route: RoutePath
}

/** Заглушка маршрута до реализации экранов (этапы 4–5). */
export function ScreenStub({ route }: ScreenStubProps) {
  const screens = screensByRoute(route)
  const main = screens.find((s) => s.kind === 'page') ?? screens[0]
  if (!main) return null
  const others = screens.filter((s) => s !== main)

  return (
    <article className="flex min-h-full flex-1 flex-col gap-32">
      <header className="flex flex-col gap-8">
        <p className="type-overline text-text-muted">{ru.stub.kicker(SERIES_TITLES[main.series], main.code)}</p>
        <h1 className="type-display-lg text-text">{main.title}</h1>
        <p className="type-body text-text-secondary">{route}</p>
      </header>

      <ScreenFacts screen={main} />

      {others.length > 0 && (
        <section aria-labelledby="same-route" className="flex flex-col gap-12">
          <h2 id="same-route" className="type-heading text-text">
            {ru.stub.sameRoute}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-2xl bg-bg shadow-raised-md">
            {others.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-16 px-20 py-12">
                <span className="text-text">{s.title}</span>
                <span className="shrink-0 type-body-sm text-text-secondary">
                  {s.code} · {ru.stub.kinds[s.kind]}
                  {s.nodeId !== null && <> · <FigmaLink nodeId={s.nodeId} /></>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto">
        <Link
          to={DEV_PATHS.screens}
          className="rounded-xs type-body text-text-secondary underline underline-offset-4 hover:text-text"
        >
          {ru.stub.allScreens}
        </Link>
      </footer>
    </article>
  )
}

function ScreenFacts({ screen }: { screen: Screen }) {
  const role = useRole()
  const { pathname } = useLocation()
  const roleLabel = ru.roles[role]
  const allowed = canAccess(role, pathname)

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-32 gap-y-8 rounded-2xl bg-bg p-28 type-body shadow-raised-md">
      <dt className="text-text-secondary">{ru.stub.prdSection}</dt>
      <dd className="text-text">{screen.prd}</dd>
      <dt className="text-text-secondary">{ru.stub.design}</dt>
      <dd className="text-text">
        {screen.nodeId === null ? ru.stub.noDesign : <FigmaLink nodeId={screen.nodeId} />}
      </dd>
      <dt className="text-text-secondary">{ru.stub.status}</dt>
      <dd className="text-text">todo</dd>
      <dt className="text-text-secondary">{ru.stub.role}</dt>
      <dd className="text-text" data-testid="current-role" data-role={role}>
        {roleLabel}
      </dd>
      <dt className="text-text-secondary">{ru.stub.access}</dt>
      <dd className={allowed ? 'text-text' : 'text-danger'} data-testid="route-access">
        {allowed ? ru.stub.accessAllowed : ru.errors.accessDenied(roleLabel)}
      </dd>
    </dl>
  )
}

function FigmaLink({ nodeId }: { nodeId: string }) {
  return (
    <a
      href={figmaUrl(nodeId)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-4 rounded-xs text-text underline underline-offset-4 hover:text-text-secondary"
    >
      {nodeId}
      <ExternalLink aria-hidden size={14} />
    </a>
  )
}
