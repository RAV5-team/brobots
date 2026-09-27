import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { DemoAccount } from '@/shared/auth/demoAccounts'
import { ru } from '@/shared/i18n/ru'

interface DemoAccessListProps {
  readonly accounts: readonly DemoAccount[]
  readonly onPick: (account: DemoAccount) => void
}

/**
 * Плашки демо-доступов жюри (ТЗ 8.2.5; 15935:78). Только в демо-сборке (D-16; PRD 15 · №56):
 * без учёток из окружения блок не рисуется. Нажатие подставляет почту и пароль в форму.
 */
export function DemoAccessList({ accounts, onPick }: DemoAccessListProps) {
  if (accounts.length === 0) return null
  const t = ru.login.cabinet

  return (
    <Card as="ul" variant="accent" padding={8} aria-label={t.demoAccessLabel}>
      {accounts.map((account) => (
        <li key={account.role}>
          <button
            type="button"
            onClick={() => { onPick(account) }}
            className="group flex w-full items-center gap-12 rounded-2xl bg-accent-surface py-12 pr-8 pl-20 text-left transition-shadow hover:shadow-accent-raised active:shadow-accent-inset"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-4">
              <span className="type-caption text-on-accent">{t.demoAccess[account.role]}</span>
              <span className="type-body font-medium text-text">
                {account.email} · {account.password}
              </span>
            </span>
            <span
              aria-hidden
              title={t.fillHint}
              className="flex size-44 shrink-0 items-center justify-center rounded-full bg-accent-surface text-text shadow-accent-raised group-active:shadow-accent-inset"
            >
              <ArrowRight size={16} />
            </span>
          </button>
        </li>
      ))}
    </Card>
  )
}
