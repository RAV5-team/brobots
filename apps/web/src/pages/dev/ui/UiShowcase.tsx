import { Link, useParams } from 'react-router'
import { ru } from '@/shared/i18n/ru'
import { SHOWCASES } from './showcases'

/** Витрина примитивов: /dev/ui — список, /dev/ui/:primitive — варианты × состояния. */
export function UiShowcase() {
  const { primitive } = useParams()
  const current = SHOWCASES.find((s) => s.slug === primitive)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-32 px-40 py-40">
      <header className="flex flex-col gap-12">
        <h1 className="type-display-lg text-text">{current ? current.title : ru.dev.uiTitle}</h1>
        <nav aria-label={ru.dev.uiTitle} className="flex flex-wrap gap-8">
          {SHOWCASES.map((s) => (
            <Link
              key={s.slug}
              to={`/dev/ui/${s.slug}`}
              aria-current={s.slug === primitive ? 'page' : undefined}
              className="rounded-full bg-bg px-12 py-6 type-caption font-medium text-text shadow-raised-sm hover:bg-surface-sunken aria-[current=page]:bg-inverse aria-[current=page]:text-on-inverse aria-[current=page]:shadow-none"
            >
              {s.title}
            </Link>
          ))}
        </nav>
      </header>
      {current ? <current.Component /> : <p className="type-body text-text-secondary">{ru.dev.uiHint}</p>}
    </div>
  )
}
