import { ru } from '@/shared/i18n/ru'
import { StatTile } from '@/components/ui/StatTile'
import { summaryLine, tiles } from '../../steps/economics/economicsView'
import { abstractText, summaryRows, tcoLine, type ReportContext } from '../reportModel'
import { FactTable, ReportSection } from '../ReportSection'

const t = ru.report.summary

/**
 * 1. Краткое заключение (16197:2327–2330; PRD 11.6): абзац вывода, пять показателей 08 (`tiles`, D-106 — не пять
 * плиток макета), строка «стоимость операции · ROI · TCO», TCO трёх сценариев и таблица первой страницы.
 */
export function SummarySection({ ctx }: { readonly ctx: ReportContext }) {
  return (
    <ReportSection n={1} sectionKey="summary">
      <p className="type-body text-text-secondary">{abstractText(ctx)}</p>
      <ul aria-label={ru.project.economics.tiles.label} className="grid grid-cols-5 gap-12 break-inside-avoid">
        {tiles(ctx.scenario, ctx.economics).map((tile) => <StatTile key={tile.key} label={tile.label} value={tile.value} caption={tile.caption} />)}
      </ul>
      <div className="flex flex-col gap-4">
        <p className="type-body-sm text-text">{summaryLine(ctx.scenario, ctx.economics)}</p>
        <p className="type-body-sm text-text">{tcoLine(ctx)}</p>
      </div>
      <FactTable caption={t.tableCaption} rows={summaryRows(ctx)} />
    </ReportSection>
  )
}
