import { PROJECTS } from '@/mocks/fixtures/projects'
import type { ProjectService } from '../projects'
import { findOrReject, respond, type MockOptions } from './respond'

export function createMockProjects(options: MockOptions): ProjectService {
  return {
    listProjects: () => respond([...PROJECTS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), options),
    getProject: (id) => findOrReject(PROJECTS, (p) => p.id === id, `Проект ${id} не найден`, options),
  }
}
