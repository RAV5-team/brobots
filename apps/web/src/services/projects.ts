import type {
  DraftProject,
  LocationProcessId,
  EconomicsResult,
  MatchingEvaluation,
  NewProjectDraft,
  Project,
  ProjectId,
  ProjectInputsPatch,
  ProjectParamsSnapshot,
  ProjectStep,
  SavedProject,
  SimulationJob,
  SimulationRequest,
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
  /**
   * Снимок входных данных шага 1 (`GET /projects/{id}/snapshot` и процессы локации): профиль локации, процессы площадки
   * с шаблонами, параметры площадки для подбора, предвыбранное решение. Только для чтения (PRD 11.2).
   */
  getParamsSnapshot(id: ProjectId): Promise<ProjectParamsSnapshot>
  /**
   * Выбрать процесс проекта на шаге 1 (PRD 11.1: ровно один). Решения следующих шагов считались для прежнего процесса —
   * сбрасываются, черновик возвращается на «Параметры» (D-94). Сохранённая оценка — ConflictError.
   */
  selectProcess(id: ProjectId, locationProcessId: LocationProcessId): Promise<Project>
  /** Открыт шаг: черновик запоминает самый дальний. Закрытый шаг — ConflictError. */
  openStep(id: ProjectId, step: ProjectStep): Promise<Project>
  /** Расчёт подбора (`GET /projects/{id}/evaluation`). Не рассчитан — NotFoundError. */
  getMatching(id: ProjectId): Promise<MatchingEvaluation>
  /**
   * Пересчитать подбор (`POST /projects/{id}/evaluate`) по текущим параметрам: снимает пометку «устарело» (D-89).
   * Выбор варианта сохраняется (api-contract.md, №12). Сохранённая оценка — ConflictError.
   */
  evaluateMatching(id: ProjectId): Promise<MatchingEvaluation>
  /**
   * Поставить прогон в очередь (`POST /api/simulations`) по составу и условиям с экрана. Ход и события прогресса —
   * `SimulationRunService` (опрос задания); прогон в проект записывает он же. Сохранённая оценка — ConflictError.
   */
  startSimulation(id: ProjectId, request: SimulationRequest): Promise<SimulationJob>
  /** Ход задания (`GET /api/simulations/jobs/{id}`): журнал строками, секунды, готовый прогон. Отмены в API нет (№14). */
  getSimulationJob(jobId: string): Promise<SimulationJob>
  getSimulationRun(runId: string): Promise<SimulationRun>
  /** 2D-трассы прогона (`GET /api/simulations/{id}/traces`): «из подбора» и, если состав изменился, итоговая. */
  getSimulationTraces(runId: string): Promise<readonly SimulationTrace[]>
  /** Итог и экономика выбранного решения (из расчёта подбора; отдельного эндпоинта нет). */
  getEconomics(id: ProjectId): Promise<EconomicsResult>
  /**
   * Запросить коммерческое предложение по выбранному решению (08b, D-106): отметка времени в проекте.
   * Оценку не меняет — доступно черновику и сохранённой. В API эндпоинта нет — api-contract.md.
   */
  requestQuote(id: ProjectId): Promise<Project>
  /** Сохранить оценку (`POST /projects/{id}/save`): снимок выбранного сценария, дальше только просмотр. */
  save(id: ProjectId): Promise<SavedProject>
}
