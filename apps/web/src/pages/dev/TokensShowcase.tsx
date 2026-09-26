import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'
import {
  COLOR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS, SIZE_TOKENS, SPACE_TOKENS, TYPE_CLASSES, TYPE_TOKENS,
} from './tokenCatalog'

const readToken = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Служебная витрина токенов из tokens.css — для сверки с audit.json и tokens.md. */
export function TokensShowcase() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-40 px-40 py-40">
      <header className="flex flex-col gap-8">
        <h1 className="type-display-lg">{ru.dev.tokensTitle}</h1>
        <p className="type-body text-text-secondary">
          {ru.dev.tokensLead}
        </p>
      </header>

      <Section title={ru.dev.tokenGroups.colors}>
        <ul className="grid grid-cols-4 gap-x-16 gap-y-20">
          {COLOR_TOKENS.map((name) => (
            <li key={name} className="flex flex-col gap-8">
              <span
                className="h-44 rounded-md border border-border"
                style={{ background: `var(--rav-color-${name})` }}
              />
              <TokenLabel variable={`--rav-color-${name}`} utility={`bg-${name}`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={ru.dev.tokenGroups.typography}>
        <ul className="flex flex-col gap-16">
          {TYPE_TOKENS.map((t) => (
            <li key={t.name} className="grid grid-cols-[200px_1fr] items-baseline gap-24">
              <span className="type-caption text-text-secondary">
                type-{t.name}
                <br />
                {t.spec}
              </span>
              <span className={TYPE_CLASSES[t.name]}>{ru.dev.typeSample}</span>
            </li>
          ))}
          <li className="grid grid-cols-[200px_1fr] items-baseline gap-24">
            <span className="type-caption text-text-secondary">
              {ru.dev.weightOverride}
              <br />
              {ru.dev.weightOverrideHint}
            </span>
            <span className="flex gap-24">
              <span className="type-body" data-probe="weight-regular">{ru.dev.weights.regular}</span>
              <span className="type-body font-medium" data-probe="weight-medium">{ru.dev.weights.medium}</span>
              <span className="type-body font-semibold" data-probe="weight-semibold">{ru.dev.weights.semibold}</span>
            </span>
          </li>
        </ul>
      </Section>

      <Section title={ru.dev.tokenGroups.radii}>
        <ul className="flex flex-wrap gap-32">
          {RADIUS_TOKENS.map((r) => (
            <li key={r.name} className="flex flex-col items-center gap-8">
              <span className={clsx('size-48 bg-surface-sunken shadow-inset-sm', r.className)} />
              <TokenLabel variable={`--rav-radius-${r.name}`} utility={r.className} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={ru.dev.tokenGroups.spacing}>
        <SpaceScale variablePrefix="--rav-space-" values={SPACE_TOKENS} />
        <h3 className="type-caption text-text-secondary">{ru.dev.controlSizes}</h3>
        <SpaceScale variablePrefix="--rav-size-" values={SIZE_TOKENS} />
      </Section>

      <Section title={ru.dev.tokenGroups.shadows}>
        <ul className="grid grid-cols-4 gap-32">
          {SHADOW_TOKENS.map((s) => (
            <li key={s.name} className="flex flex-col gap-12">
              <span className={clsx('h-48 rounded-xl', s.accent ? 'bg-accent-surface' : 'bg-bg', s.className)} />
              <TokenLabel variable={`--rav-shadow-${s.name}`} utility={s.className} />
            </li>
          ))}
        </ul>
      </Section>
    </main>
  )
}

function SpaceScale({ variablePrefix, values }: { variablePrefix: string; values: readonly number[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {values.map((px) => (
        <li key={px} className="grid grid-cols-[200px_1fr] items-center gap-24">
          <span className="type-caption text-text-secondary">
            {variablePrefix}{px} · p-{px}
          </span>
          <span className="h-10 rounded-xs bg-accent-surface" style={{ width: `var(${variablePrefix}${String(px)})` }} />
        </li>
      ))}
    </ul>
  )
}

function TokenLabel({ variable, utility }: { variable: string; utility: string }) {
  return (
    <span className="flex flex-col type-caption-xs text-text-secondary">
      <code>{variable}</code>
      <span>
        {utility} · {readToken(variable) || '—'}
      </span>
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-16">
      <h2 className="type-overline text-text-muted">{title}</h2>
      {children}
    </section>
  )
}
