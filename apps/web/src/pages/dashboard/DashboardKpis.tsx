import { KpiCard } from '@/components/ui/Card'
import { formatNumber, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { Dashboard } from './dashboardModel'

const t = ru.dashboard.kpi

/** Четыре показателя (PRD 8.2; 15935:121). */
export function DashboardKpis({ dashboard }: { readonly dashboard: Dashboard }) {
  const facilityTypes = dashboard.facilityTypes.map((code) => ru.facilityTypesLower[code]).join(', ')
  return (
    <section aria-labelledby="dashboard-kpi" className="grid grid-cols-4 gap-16">
      <h2 id="dashboard-kpi" className="sr-only">{t.heading}</h2>
      <KpiCard label={t.locations} value={formatNumber(dashboard.locationCount)} caption={facilityTypes} />
      <KpiCard
        label={t.projects}
        value={formatNumber(dashboard.projectCount)}
        caption={t.calculated(formatNumber(dashboard.calculatedCount))}
      />
      <KpiCard label={t.manualLabor} value={formatRubCompact(dashboard.manualLaborRub)} caption={t.manualLaborCaption} />
      <KpiCard label={t.savings} value={formatRubCompact(dashboard.savingsRub)} caption={t.savingsCaption} />
    </section>
  )
}
