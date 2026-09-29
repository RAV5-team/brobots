import type { IsoDateTime } from './common'
import type { LocationId } from './location'
import type { LocationProcessId } from './locationProcess'
import type { ProjectInputs } from './projectInputs'

/** В API — UUID, в фикстурах — PJ-NN. */
export type ProjectId = string

/** Шаг проекта: параметры → подбор → симуляция → итог и экономика (PRD 0.9, раздел 11). */
export type ProjectStep = 'params' | 'matching' | 'simulation' | 'economics'

/** Версии данных, на которых считается проект: «снимок 15.09.2026 · каталог v4 · модель 2.1» (PRD 11.5, 11.6). */
export interface DataVersions {
  /** Дата снимка профиля локации (YYYY-MM-DD). */
  readonly snapshotAt: string
  readonly catalog: number
  readonly model: string
  /** Версия нормативов А5; null — проект создан до версий нормативов. */
  readonly norms: number | null
}

interface ProjectBase {
  readonly id: ProjectId
  readonly name: string
  readonly locationId: LocationId
  /** Процесс проекта — ровно один (PRD 11.1); null — черновик, где процесс ещё не выбран на шаге 1. */
  readonly locationProcessId: LocationProcessId | null
  readonly versions: DataVersions
  /** Решения пользователя по шагам; расчёты — ответы сервиса. */
  readonly inputs: ProjectInputs
  readonly updatedAt: IsoDateTime
  /**
   * Демо-проект организатора (ролевая модель, §5): гость проходит его без сохранения — решения живут в браузере,
   * расчёты идут без записи. Вошедшему пользователю в списках не показывается.
   */
  readonly isDemo?: boolean
}

/** Черновик: всё можно менять, открывается на шаге, где остановились (PRD 11.1). Цифр результата нет. */
export interface DraftProject extends ProjectBase {
  readonly status: 'draft'
  /** Самый дальний пройденный шаг: назад — на любой пройденный, вперёд — кнопкой CTA на следующий. */
  readonly step: ProjectStep
  /** Решение из каталога («Проверить на объекте», D-57): подбор начнёт с него. В API — `pinnedSolutionId`. */
  readonly pinnedSolutionId?: string
}

/** Черновик из окна «Новый проект» (A2): локация, а процесс и решение — если окно открыли из их карточек. */
export interface NewProjectDraft {
  readonly name: string
  readonly locationId: LocationId
  readonly locationProcessId?: LocationProcessId
  readonly solutionId?: string
}

/** Сохранённая оценка: все шаги открываются только для просмотра (D-17), цифры — из снимка и не пересчитываются. */
export interface SavedProject extends ProjectBase {
  readonly status: 'saved'
  readonly locationProcessId: LocationProcessId
  readonly savedAt: IsoDateTime
  readonly result: ProjectResultSnapshot
}

/** Проект: черновик или сохранённая оценка. */
export type Project = DraftProject | SavedProject

/**
 * Снимок результата выбранного сценария на момент сохранения (ТЗ 3.1.5, 3.7.2):
 * те же числа показывают список A1, итог 4.x, отчёт и выгрузка.
 */
export interface ProjectResultSnapshot {
  readonly capexRub: number
  readonly opexRubPerYear: number
  readonly paybackYears: number
  /** Чистый годовой эффект; null — в источниках нет (нужен дашборду для «Найденной экономии», PRD 8.2). */
  readonly annualEffectRub: number | null
}
