import { ru } from '@/shared/i18n/ru'
import { paramsView } from '../../steps/params/paramsModel'
import { ValueTable } from '../../shared/ValueTable'
import type { ReportContext } from '../reportModel'
import { ReportSection, ReportSubheading } from '../ReportSection'

const t = ru.report.inputs

/**
 * 3. Исходные условия (PRD 11.6): группы процесса А–Г и параметры площадки со статусами — те же строки, что на
 * шаге 1 (`paramsView`, `ValueTable`); площадка — только применимые к процессу.
 */
export function InputsSection({ ctx }: { readonly ctx: ReportContext }) {
  const view = paramsView(ctx.snapshot, ctx.project.locationProcessId, ctx.project.inputs.params.assumptions)
  return (
    <ReportSection n={3} sectionKey="inputs" lead={t.lead}>
      <ReportSubheading>{t.process}</ReportSubheading>
      {view.groups.map((group) => <ValueTable key={group.key} title={group.title} rows={group.rows} />)}
      <ReportSubheading>{t.site}</ReportSubheading>
      {view.siteGroups.map((group) => {
        const rows = group.rows.filter((row) => row.applicable)
        return rows.length > 0 && <ValueTable key={group.key} title={group.title} rows={rows} />
      })}
    </ReportSection>
  )
}
