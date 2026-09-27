import { clsx } from 'clsx'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { SCREENS, SERIES_TITLES, samplePath, type Screen, type ScreenSeries } from '@/app/screens'
import { ROLES } from '@/domain'
import { useServices } from '@/services/useServices'
import { ROLE_QUERY_PARAM } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { SCREEN_SCENARIOS, type ScreenScenario } from './screenScenarios'

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
                    <ScreenLink screen={s} />
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

const LINK_CLASS = 'rounded-xs text-text underline-offset-4 hover:underline'

function ScreenLink({ screen }: { readonly screen: Screen }) {
  const scenario = SCREEN_SCENARIOS[screen.id]
  if (scenario) return <ScenarioLink title={screen.title} scenario={scenario} />
  if (screen.route === null) return <span className="text-text-muted">{screen.title}</span>
  return <Link to={samplePath(screen.route)} className={LINK_CLASS}>{screen.title}</Link>
}

/** Экран-состояние: сначала сценарий (например, сохранить локацию), затем переход с состоянием навигации. */
function ScenarioLink({ title, scenario }: { readonly title: string; readonly scenario: ScreenScenario }) {
  const services = useServices()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const open = () => {
    setFailed(false)
    scenario(services)
      .then(({ to, state }) => navigate(to, { state }))
      .catch((error: unknown) => {
        console.error('Сценарий экрана не выполнился', error)
        setFailed(true)
      })
  }
  return (
    <>
      <button type="button" onClick={open} className={clsx(LINK_CLASS, 'cursor-pointer text-left')}>{title}</button>
      {failed && <span role="alert" className="ml-8 text-danger">{ru.dev.scenarioFailed}</span>}
    </>
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
