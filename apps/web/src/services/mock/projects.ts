import type { DraftProject, Project, ProjectId } from '@/domain'
import { PROJECTS } from '@/mocks/fixtures/projects'
import type { ProjectService } from '../projects'
import { findOrReject, respond, type MockOptions } from './respond'

/** Id проекта — следующий за наибольшим: PJ-06 после пяти демо-проектов. */
function nextId(projects: readonly Project[]): ProjectId {
  const last = Math.max(0, ...projects.map((p) => Number(p.id.slice('PJ-'.length)) || 0))
  return `PJ-${String(last + 1).padStart(2, '0')}`
}

export function createMockProjects(options: MockOptions): ProjectService {
  // Созданные черновики живут до перезагрузки страницы: фикстуры не меняются.
  let projects: readonly Project[] = PROJECTS
  return {
    listProjects: () => respond([...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), options),
    getProject: (id) => findOrReject(projects, (p) => p.id === id, `Проект ${id} не найден`, options),
    createDraft: ({ name, locationId, locationProcessId, solutionId }) => {
      const draft: DraftProject = {
        id: nextId(projects),
        name,
        locationId,
        processIds: locationProcessId ? [locationProcessId] : [],
        status: 'draft',
        step: 'params',
        updatedAt: new Date().toISOString(),
        ...(solutionId ? { solutionId } : {}),
      }
      projects = [...projects, draft]
      return respond(draft, options)
    },
  }
}
