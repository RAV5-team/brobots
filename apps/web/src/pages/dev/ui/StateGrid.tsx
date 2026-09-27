import type { ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'
import type { DemoState } from './demoState'

interface Row {
  readonly label: string
  readonly render: (state: DemoState) => ReactNode
}

/** Сетка витрины: варианты по строкам, состояния по столбцам. */
export function StateGrid({ states, rows }: { readonly states: readonly DemoState[]; readonly rows: readonly Row[] }) {
  return (
    <table className="w-full border-separate border-spacing-x-16 border-spacing-y-12">
      <thead>
        <tr>
          <th scope="col" className="text-left type-overline text-text-muted">{ru.dev.variant}</th>
          {states.map((s) => (
            <th key={s} scope="col" className="text-left type-overline text-text-muted">{ru.dev.states[s]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className="pr-16 text-left align-middle whitespace-nowrap type-caption font-medium text-text-secondary">{row.label}</th>
            {states.map((s) => (
              <td key={s} className="align-middle">{row.render(s)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ShowcaseSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-16 rounded-2xl bg-bg p-28 shadow-raised-md">
      <h2 className="type-heading text-text">{title}</h2>
      {children}
    </section>
  )
}
