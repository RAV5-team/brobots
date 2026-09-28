// Источник: PRD 11.1, таблица экрана «Проекты» (7 проектов); снимки сохранённых оценок — значения итога PRD 11.5 (№106).
// Форма — ответ GET /api/v1/projects/{id} (api.yaml, схема Project). Правится вручную. Отступления — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { ApiSchemas } from '@/api/contract'
import { toProject, type ProjectLocalState } from '@/api/mappers/project'
import type { Project, ProjectInputs } from '@/domain'
import { emptyInputs } from '@/domain'

/** Версии данных снимка проекта — те же, что в данных сессии (`session.ts`: каталог v4, модель 2.1). */
export const PROJECT_VERSIONS = { catalog: 4, model: '2.1', norms: 3, dictionaries: 1 }
const SNAPSHOT = '2026-09-15T00:00:00Z'

const project = (dto: ApiSchemas['Project']): ApiSchemas['Project'] => ({ versions: PROJECT_VERSIONS, snapshotTakenAt: SNAPSHOT, ...dto })

export const PROJECT_DTOS: readonly ApiSchemas['Project'][] = [
  project({ id: 'PJ-01', name: 'Роботизация паллетного потока · РЦ Химки', locationId: 'LOC-01', locationName: 'РЦ Химки', task: { id: 'LP-01', name: 'Перемещение паллет' }, status: 'saved', updatedAt: '2026-09-15T11:32:00Z', savedAt: '2026-09-15T11:32:00Z', selection: { solutionId: 'RB-0008', solutionName: 'AMR 800', acquisitionModel: 'raas', calcResultId: 'CR-AMR800-RAAS' } }),
  project({ id: 'PJ-02', name: 'Только уборка · РЦ Химки', locationId: 'LOC-01', locationName: 'РЦ Химки', task: { id: 'LP-04', name: 'Уборка склада' }, status: 'draft', updatedAt: '2026-09-14T15:05:00Z' }),
  project({ id: 'PJ-03', name: 'Комплектация заказов · Даркстор Юг', locationId: 'LOC-02', locationName: 'Даркстор Юг', task: { id: 'LP-07', name: 'Комплектация заказов' }, status: 'saved', updatedAt: '2026-09-13T08:20:00Z', savedAt: '2026-09-13T08:20:00Z' }),
  project({ id: 'PJ-04', name: 'Багаж терминала · Внуково-2', locationId: 'LOC-03', locationName: 'Терминал Внуково-2', task: { id: 'LP-09', name: 'Перемещение багажа' }, status: 'draft', updatedAt: '2026-09-12T09:00:00Z' }),
  project({ id: 'PJ-05', name: 'Внутрибольничная логистика · ГКБ №17', locationId: 'LOC-04', locationName: 'ГКБ №17', task: { id: 'LP-12', name: 'Внутрибольничная логистика' }, status: 'saved', updatedAt: '2026-09-11T16:00:00Z', savedAt: '2026-09-11T16:00:00Z' }),
  project({ id: 'PJ-06', name: 'Паллетный поток v2 · РЦ Химки', locationId: 'LOC-01', locationName: 'РЦ Химки', task: { id: 'LP-01', name: 'Перемещение паллет' }, status: 'saved', updatedAt: '2026-09-10T10:00:00Z', savedAt: '2026-09-10T10:00:00Z', selection: { solutionId: 'RB-0008', solutionName: 'AMR 800', acquisitionModel: 'purchase', calcResultId: 'CR-AMR800-PURCHASE' } }),
  project({ id: 'PJ-07', name: 'Инвентаризация · РЦ Химки', locationId: 'LOC-01', locationName: 'РЦ Химки', task: { id: 'LP-05', name: 'Инвентаризация' }, status: 'draft', updatedAt: '2026-09-09T14:00:00Z' }),
]

/**
 * Демо-проект для прохождения шагов 02–09 и /dev/screens: РЦ Химки · перемещение паллет, дошёл до итога.
 * В список A1 не входит (таблица PRD 11.1 — 7 строк). Кандидат в «Демо-проекты» гостя (D-26, ждёт скрытую секцию).
 */
export const DEMO_PROJECT_DTO: ApiSchemas['Project'] = project({
  id: 'PJ-DEMO', name: 'Демо-проект · РЦ Химки', locationId: 'LOC-01', locationName: 'РЦ Химки', isDemo: true,
  task: { id: 'LP-01', name: 'Перемещение паллет' }, status: 'draft', updatedAt: '2026-09-26T09:00:00Z',
  // Открыт из каталога «Проверить на объекте» (D-57): шаг 1 показывает предвыбранное решение.
  pinnedSolutionId: 'RB-0008',
  selection: { solutionId: 'RB-0008', solutionName: 'AMR 800', acquisitionModel: 'raas', calcResultId: 'CR-AMR800-RAAS' },
})

const inputs = (patch: Partial<ProjectInputs>, at: string): ProjectInputs => ({ ...emptyInputs(at), ...patch })

const amr800 = (acquisition: 'raas' | 'purchase') =>
  ({ calcParams: {}, selection: { solutionId: 'RB-0008', acquisition }, manualSolutionIds: [] }) as const

/** Проверенный состав сквозного примера: 18 роботов, 6 станций, прогон SIM-0926-01 (PRD 11.4–11.5). */
const VERIFIED = { stage: 'verdict', fleet: { robots: 18, stations: 6 }, conditions: {}, runId: 'SIM-0926-01', plan: { robots: 18, stations: 6 }, acceptRisk: false } as const

/**
 * Чего нет в ответе API: шаг черновика, решения по шагам, снимок результата сохранённой оценки.
 * Вопросы бэкенду — apps/web/docs/api-contract.md. PJ-03 и PJ-05: решение в PRD не названо — выбора и подбора нет.
 */
export const PROJECT_LOCAL_STATE: Readonly<Record<string, ProjectLocalState>> = {
  'PJ-01': {
    step: 'economics',
    inputs: inputs({ matching: amr800('raas'), simulation: VERIFIED, economics: { scenario: 'raas' } }, '2026-09-15T11:32:00Z'),
    result: { capexRub: 6100000, opexRubPerYear: 42000000, paybackYears: 0.7, annualEffectRub: 9200000 },
  },
  'PJ-02': { step: 'params', inputs: emptyInputs('2026-09-14T15:05:00Z'), result: null },
  'PJ-03': { step: 'economics', inputs: emptyInputs('2026-09-13T08:20:00Z'), result: { capexRub: 52400000, opexRubPerYear: 21300000, paybackYears: 1.6, annualEffectRub: null } },
  'PJ-04': { step: 'matching', inputs: inputs({ matching: { calcParams: {}, selection: null, manualSolutionIds: [] } }, '2026-09-12T09:00:00Z'), result: null },
  'PJ-05': { step: 'economics', inputs: emptyInputs('2026-09-11T16:00:00Z'), result: { capexRub: 84000000, opexRubPerYear: 12500000, paybackYears: 7, annualEffectRub: null } },
  'PJ-06': {
    step: 'economics',
    inputs: inputs({ matching: amr800('purchase'), economics: { scenario: 'purchase' } }, '2026-09-10T10:00:00Z'),
    result: { capexRub: 47400000, opexRubPerYear: 34500000, paybackYears: 2.8, annualEffectRub: 16700000 },
  },
  // PRD 11.1 ставит инвентаризацию на «Симуляцию», но по 11.2 её подбор заблокирован (нет частоты пересчёта) — черновик на «Параметрах».
  'PJ-07': { step: 'params', inputs: emptyInputs('2026-09-09T14:00:00Z'), result: null },
  'PJ-DEMO': {
    step: 'economics',
    inputs: inputs({ matching: amr800('raas'), simulation: VERIFIED, economics: { scenario: 'raas' } }, '2026-09-26T09:00:00Z'),
    result: null,
  },
}

const localState = (id: string | undefined): ProjectLocalState => {
  const state = id === undefined ? undefined : PROJECT_LOCAL_STATE[id]
  if (!state) throw new Error(`Фикстура проекта ${String(id)}: нет состояния в PROJECT_LOCAL_STATE`)
  return state
}

/** Проекты списка A1 в форме экрана — через тот же маппер, что и сервис. */
export const PROJECTS: readonly Project[] = PROJECT_DTOS.map((dto) => toProject(dto, localState(dto.id)))

export const DEMO_PROJECT: Project = toProject(DEMO_PROJECT_DTO, localState(DEMO_PROJECT_DTO.id))
