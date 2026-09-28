import { Navigate, useSearchParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Search } from '@/components/ui/Search'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { ProjectsTable } from './ProjectsTable'
import {
  EMPTY_FILTER,
  PROJECTS_TABS,
  buildRows,
  countByTab,
  filterRows,
  isFilterActive,
  parseProjectsSearch,
  toProjectsSearch,
  type ProjectsFilter,
} from './projectsModel'
import { useProjects, type ProjectsData } from './useProjects'

const t = ru.projects

function ProjectsContent({ data }: { readonly data: ProjectsData }) {
  const [params, setParams] = useSearchParams()
  const filter = parseProjectsSearch(params)
  const update = (next: ProjectsFilter) => { setParams(toProjectsSearch(next), { replace: true }) }
  const counts = countByTab(data.projects)
  const rows = filterRows(buildRows(data.projects, data.locations), filter)

  if (data.projects.length === 0) return <EmptyState size="lg" title={t.empty.title} description={t.empty.description} />

  return (
    <>
      <div className="flex items-center gap-8">
        <Segmented
          label={t.tabsLabel}
          fit="content"
          size={44}
          value={filter.tab}
          onChange={(tab) => { update({ ...filter, tab }) }}
          options={PROJECTS_TABS.map((tab) => ({ value: tab, label: t.tabs[tab], count: counts[tab] }))}
        />
        <div className="min-w-0 flex-1">
          <Search label={t.search} value={filter.query} onChange={(e) => { update({ ...filter, query: e.target.value }) }} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t.notFound.title}
          description={t.notFound.description}
          action={isFilterActive(filter) && <Button onClick={() => { update(EMPTY_FILTER) }}>{t.notFound.reset}</Button>}
        />
      ) : (
        <Card padding={8} gap={4}>
          {/* Панель p8, строки таблицы с отступом 12 по бокам (16362:8225, 16362:8243). */}
          <div className="px-12">
            <ProjectsTable rows={rows} />
          </div>
        </Card>
      )}

      {/* Подписи на макете нет, она из PRD 11.1 (D-83). */}
      <p className="type-caption text-text-muted">{t.legend}</p>
    </>
  )
}

/** Экран A1 «Проекты» (PRD 11.1; 16325:14). Пользователь и администратор; гостя — в каталог (D-82). */
export function ProjectsPage() {
  const role = useRole()
  const { state, retry } = useProjects()

  // У гостя «Демо-проекты» — свой список, он ждёт скрытую секцию Figma (D-82).
  if (role === 'guest') return <Navigate to={ROUTE_PATHS.catalog} replace />

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {state.status === 'loading' && <Skeleton className="h-(--rav-location-card-height)" />}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && <ProjectsContent data={state} />}
    </>
  )
}
