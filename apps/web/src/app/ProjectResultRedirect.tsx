import { Navigate, useLocation, useParams } from 'react-router'
import type { ProjectId } from '@/domain'
import { projectStepPath } from './routePaths'

/** Старый адрес сохранённой оценки `/result` → шаг «Итог и экономика» с тем же `?…` (D-22). */
export function ProjectResultRedirect() {
  const { projectId = '' } = useParams()
  const { search } = useLocation()
  return <Navigate replace to={`${projectStepPath(projectId as ProjectId, 'economics')}${search}`} />
}
