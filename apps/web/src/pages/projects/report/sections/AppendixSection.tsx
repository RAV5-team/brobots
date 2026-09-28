import { FormulaStats } from '@/components/ui/FormulaStats'
import { formatCount, formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { demandOf, howCalcSections } from '../../steps/matching/howCalculatedModel'
import { isCountSection, type FactRow, type ReportContext } from '../reportModel'
import { FactTable, ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.appendix

/**
 * 12. Приложения (16197:2476–2478; PRD 11.6; ТЗ 3.1.5, 3.5.8): версии данных для воспроизведения расчёта, источники
 * и формулы денег и балла рейтинга выбранного варианта (потребность и парк — в разделе 5).
 */
export function AppendixSection({ ctx }: { readonly ctx: ReportContext }) {
  const { project, matching, run, variant } = ctx
  const k = t.rows
  const criteria = (variant ?? matching.variants.find((v) => v.criteria.length > 0))?.criteria.length ?? 0
  const rows: readonly FactRow[] = [
    { key: 'snapshot', label: k.snapshot, value: formatDate(project.versions.snapshotAt) },
    { key: 'catalog', label: k.catalog, value: `v${String(project.versions.catalog)}` },
    { key: 'model', label: k.model, value: project.versions.model },
    { key: 'norms', label: k.norms, value: project.versions.norms === null ? t.noNorms : t.norms(project.versions.norms) },
    { key: 'evaluation', label: k.evaluation, value: matching.id },
    { key: 'run', label: k.run, value: run?.id ?? ru.project.economics.data.noRun },
    { key: 'criteria', label: k.criteria, value: formatCount(criteria, ru.plural.criteria) },
  ]
  const { processName, demand } = demandOf(ctx.snapshot, matching, project)
  const formulas = variant
    ? howCalcSections({ variant, processName, demand, params: matching.calcDefaults, baseline: matching.baseline })
      .filter((s) => !isCountSection(s.key))
    : []
  return (
    <ReportSection n={12} sectionKey="appendix">
      <ReportSubheading>{t.versions}</ReportSubheading>
      <FactTable caption={t.versionsCaption} rows={rows} />
      <p className="type-body-sm text-text-secondary">{t.sources}</p>
      <ReportSubheading>{t.formulas}</ReportSubheading>
      {formulas.map((section) => (
        <div key={section.key} className="flex flex-col gap-4 break-inside-avoid">
          <p className="type-overline font-medium text-text-muted">{section.title}</p>
          <FormulaStats label={`${t.formulas} · ${section.title}`} stats={section.stats} layout="list" />
        </div>
      ))}
      <p className="type-caption text-text-secondary">{ru.project.economics.tiles.glossary}</p>
    </ReportSection>
  )
}
