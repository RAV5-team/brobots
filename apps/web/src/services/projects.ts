import type {
  DraftProject,
  EconomicsResult,
  MatchingEvaluation,
  NewProjectDraft,
  Project,
  ProjectId,
  ProjectInputsPatch,
  ProjectStep,
  SavedProject,
  SimulationJob,
  SimulationRun,
  SimulationTrace,
} from '@/domain'

/** Проекты оценки (PRD 11). Ответы API переводятся в модель экрана мапперами src/api/mappers. */
export interface ProjectService {
  /** Сначала недавно изменённые; демо-проект в список не входит. */
  listProjects(): Promise<readonly Project[]>
  getProject(id: ProjectId): Promise<Project>
  /** Создать черновик на шаге «Параметры» (окно A2, PRD 11.1) — `POST /projects`; id присваивает сервис. */
  createDraft(input: NewProjectDraft): Promise<DraftProject>
  /**
   * Правка решений по шагам — автосохранение черновика (D-21); что устарело, отмечает правило D-89.
   * Сохранённая оценка только для просмотра (D-17): ConflictError.
   */
  updateInputs(id: ProjectId, patch: ProjectInputsPatch): Promise<Project>
  /** Открыт шаг: черновик запоминает самый дальний. Закрытый шаг — ConflictError. */
  openStep(id: ProjectId, step: ProjectStep): Promise<Project>
  /** Расчёт подбора (`GET /projects/{id}/evaluation`). Не рассчитан — NotFoundError. */
  getMatching(id: ProjectId): Promise<MatchingEvaluation>
  /** Поставить прогон в очередь (`POST /api/simulations`) по составу и условиям проекта. */
  startSimulation(id: ProjectId): Promise<SimulationJob>
  /** Ход задания (`GET /api/simulations/jobs/{id}`); готовое задание записывает прогон в проект. */
  getSimulationJob(jobId: string): Promise<SimulationJob>
  getSimulationRun(runId: string): Promise<SimulationRun>
  /** 2D-трассы прогона (`GET /api/simulations/{id}/traces`): «из подбора» и, если состав изменился, итоговая. */
  getSimulationTraces(runId: string): Promise<readonly SimulationTrace[]>
  /** Итог и экономика выбранного решения (из расчёта подбора; отдельного эндпоинта нет). */
  getEconomics(id: ProjectId): Promise<EconomicsResult>
  /** Сохранить оценку (`POST /projects/{id}/save`): снимок выбранного сценария, дальше только просмотр. */
  save(id: ProjectId): Promise<SavedProject>
}
