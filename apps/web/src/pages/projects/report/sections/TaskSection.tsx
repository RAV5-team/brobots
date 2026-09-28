import { ru } from '@/shared/i18n/ru'
import { taskRows, type ReportContext } from '../reportModel'
import { FactTable, ReportSection } from '../ReportSection'

/** 2. Задача и текущий процесс (PRD 11.6): процесс, объём, исполнители, текущие расходы — из снимка шага 1 и итога 08. */
export function TaskSection({ ctx }: { readonly ctx: ReportContext }) {
  return (
    <ReportSection n={2} sectionKey="task" lead={ru.project.economics.scope(ctx.facts?.name ?? '—', ctx.location.name)}>
      <FactTable caption={ru.report.task.caption} rows={taskRows(ctx)} />
    </ReportSection>
  )
}
