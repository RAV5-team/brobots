import type { DraftProject, NewProjectDraft, Project, ProjectId } from '@/domain'

/** Проекты оценки (PRD 11). */
export interface ProjectService {
  /** Сначала недавно изменённые. */
  listProjects(): Promise<readonly Project[]>
  getProject(id: ProjectId): Promise<Project>
  /** Создать черновик на шаге «Параметры» (окно A2, PRD 11.1) — `POST /projects`; id присваивает сервис. */
  createDraft(input: NewProjectDraft): Promise<DraftProject>
}
