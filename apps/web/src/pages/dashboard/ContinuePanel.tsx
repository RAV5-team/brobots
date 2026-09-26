import { ArrowRight } from 'lucide-react'
import { generatePath } from 'react-router'
import { PROJECT_STEP_PATHS, ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { IconButtonLink } from '@/components/ui/IconButton'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState } from '@/components/ui/States'
import type { ProjectPreliminary } from '@/domain'
import { formatDayTime, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { RecentProject } from './dashboardModel'

const t = ru.dashboard.continue

/** «0,7 года · 9,2 млн ₽/год», «2,2 года» или прочерк, если расчёта ещё нет. */
function resultText(preliminary: ProjectPreliminary | null): string {
  if (!preliminary) return t.noResult
  const payback = formatYears(preliminary.paybackYears)
  if (preliminary.annualEffectRub === null) return payback
  return `${payback} · ${formatRubCompact(preliminary.annualEffectRub, { perYear: true })}`
}

function ProjectRow({ project, locationName }: RecentProject) {
  return (
    <li className="flex items-center gap-12 rounded-md border-b border-border p-12 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h3 className="type-body font-semibold text-text">{project.name}</h3>
        <p className="type-caption text-text-secondary">{t.changed(locationName, formatDayTime(project.updatedAt))}</p>
      </div>
      <Chip size="md">{ru.dashboard.projectStatus[project.step]}</Chip>
      <p className="w-(--rav-dashboard-result-width) shrink-0 type-body font-semibold text-text">{resultText(project.preliminary)}</p>
      <IconButtonLink
        icon={ArrowRight}
        label={t.open(project.name)}
        to={generatePath(PROJECT_STEP_PATHS[project.step], { projectId: project.id })}
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
