import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Counter } from '@/components/ui/Counter'
import type { DashboardChecks } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.dashboard.checks

function summary({ total, preview }: DashboardChecks): string {
  if (total === 0) return t.none
  const rest = total - preview.length
  const listed = preview.join(' · ')
  return rest > 0 ? `${listed} ${t.more(formatNumber(rest))}` : listed
}

/**
 * «Уточнения и проверки» (PRD 8.3; 15935:138). Экрана со списком проверок в PRD 0.7 нет,
 * поэтому «Открыть» пока недоступна и объясняет почему (D-29).
 */
export function ChecksBanner({ checks }: { readonly checks: DashboardChecks }) {
  return (
    <Card variant="sunken" padding={20} className="px-24" aria-labelledby="dashboard-checks">
      <div className="flex items-center gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-4 text-text">
          <h2 id="dashboard-checks" className="type-heading">{t.title}</h2>
          <p className="type-body">{summary(checks)}</p>
        </div>
        {checks.total > 0 && (
          <Button disabled title={t.openHint} aria-label={t.openLabel(formatNumber(checks.total))} className="px-20">
            {t.open}
            <Counter value={checks.total} />
          </Button>
        )}
      </div>
    </Card>
  )
}
