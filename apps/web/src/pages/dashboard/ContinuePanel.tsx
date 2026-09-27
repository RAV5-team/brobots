import { ArrowRight } from 'lucide-react'
import { ROUTE_PATHS, projectOpenPath } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { IconButtonLink } from '@/components/ui/IconButton'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState } from '@/components/ui/States'
import type { Project } from '@/domain'
import { formatDayTime, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { RecentProject } from './dashboardModel'

const t = ru.dashboard.continue

/** «0,7 года · 9,2 млн ₽/год» или «1,6 года» из снимка сохранённой оценки; у черновика — прочерк. */
function resultText(project: Project): string {
  if (project.status === 'draft') return t.noResult
  const { paybackYears, annualEffectRub } = project.result
  const payback = formatYears(paybackYears)
  if (annualEffectRub === null) return payback
  return `${payback} · ${formatRubCompact(annualEffectRub, { perYear: true })}`
}

const statusText = (project: Project): string =>
  project.status === 'draft' ? ru.dashboard.projectStatus[project.step] : ru.dashboard.projectStatus.saved

function ProjectRow({ project, locationName }: RecentProject) {
  return (
    <li className="flex items-center gap-12 rounded-md border-b border-border p-12 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h3 className="type-body font-semibold text-text">{project.name}</h3>
        <p className="type-caption text-text-secondary">{t.changed(locationName, formatDayTime(project.updatedAt))}</p>
      </div>
      <Chip size="md">{statusText(project)}</Chip>
      <p className="w-(--rav-dashboard-result-width) shrink-0 type-body font-semibold text-text">{resultText(project)}</p>
      <IconButtonLink
        icon={ArrowRight}
        label={t.open(project.name)}
        to={projectOpenPath(project)}
      />
    </li>
  )
}

/** «Продолжить» — последние проекты (PRD 8.3; 15935:147). */
export function ContinuePanel({ projects }: { readonly projects: readonly RecentProject[] }) {
  return (
    <Card elevation="md" gap={0} className="min-w-0 flex-1" aria-labelledby="dashboard-continue">
      <SectionHeader
        title={t.title}
        id="dashboard-continue"
        actions={<ButtonLink size="sm" to={ROUTE_PATHS.projects}>{t.all}</ButtonLink>}
      />
      {projects.length === 0 ? (
        <EmptyState title={t.empty} description={t.emptyHint} />
      ) : (
        <ul className="flex flex-col">
          {projects.map((p) => <ProjectRow key={p.project.id} {...p} />)}
        </ul>
      )}
    </Card>
  )
}
