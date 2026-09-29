import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { projectStepPath } from '@/app/routePaths'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/States'
import { isDemoOpen, type Location, type Project } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.projects.demo

interface DemoRow {
  readonly project: Project
  readonly location: Location | undefined
  readonly open: boolean
}

function rowsOf(projects: readonly Project[], locations: readonly Location[]): readonly DemoRow[] {
  const rows = projects.map((project) => {
    const location = locations.find((l) => l.id === project.locationId)
    return { project, location, open: location !== undefined && isDemoOpen(location.facilityType) }
  })
  // Открытые — первыми: гость начинает с проработанного демо (ролевая модель, §5).
  return [...rows].sort((a, b) => Number(b.open) - Number(a.open))
}

function DemoCard({ project, location, open }: DemoRow) {
  const caption = location ? `${location.name} · ${ru.facilityTypesLower[location.facilityType]}` : ''
  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        <span className="type-body font-semibold text-text">{project.name}</span>
        <span className="type-caption text-text-secondary">{caption}</span>
      </div>
      {open
        ? <ArrowRight aria-hidden size={20} className="shrink-0 text-text-secondary" />
        : <Chip size="sm">{t.soon}</Chip>}
    </>
  )
  if (!open) {
    // Недоступный демо-проект виден, но не открывается: не ссылка и не в порядке фокуса.
    return (
      <li aria-disabled="true">
        <Card as="div" padding={16} className="flex-row items-center justify-between gap-16 opacity-(--rav-disabled-opacity)">
          {body}
        </Card>
      </li>
    )
  }
  return (
    <li>
      <Link to={projectStepPath(project.id, 'params')} aria-label={t.open(project.name)} className="group block rounded-3xl">
        <Card as="div" padding={16} className="flex-row items-center justify-between gap-16 transition-shadow group-hover:shadow-raised-md">
          {body}
        </Card>
      </Link>
    </li>
  )
}

/**
 * «Демо-проекты» гостя (ролевая модель, §3, §5): готовые оценки организатора по типам объектов. Гость проходит их по
 * шагам без сохранения; проработан склад — аэропорт и медучреждение видны, но пока неактивны.
 */
export function DemoProjectsList({ projects, locations }: { readonly projects: readonly Project[]; readonly locations: readonly Location[] }) {
  if (projects.length === 0) return <EmptyState size="lg" title={t.empty.title} description={t.empty.description} />
  return (
    <>
      <ul aria-label={t.label} className="flex flex-col gap-12">
        {rowsOf(projects, locations).map((row) => <DemoCard key={row.project.id} {...row} />)}
      </ul>
      <p className="type-caption text-text-muted">{t.legend}</p>
    </>
  )
}
