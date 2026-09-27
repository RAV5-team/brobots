import type { Project, ProjectId } from '@/domain'

/** Проекты оценки (PRD 11). */
export interface ProjectService {
  /** Сначала недавно изменённые. */
  listProjects(): Promise<readonly Project[]>
  getProject(id: ProjectId): Promise<Project>
}
