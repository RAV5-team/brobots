// Источник: PRD 10.1, таблицы «Четыре локации демо-организации» (= экран 12, 15950:1627).
// Здесь только то, что фронтенд пока не может посчитать сам: API отдаёт эти значения в `summary` локации,
// а в фикстурах нет занятости персонала по процессам, флагов обязательности параметров и режима работы аэропорта.
// Остальное в сводке считается моком из locations.ts, locationProcesses.ts, projects.ts и dashboard.ts (D-13).
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { LocationId } from '@/domain'

export interface LocationSummaryInputs {
  readonly locationId: LocationId
  /** «145 человек в операционных процессах». */
  readonly workersInProcesses: number
  /** «Параметры объекта 78%». */
  readonly parametersCompletenessPct: number
  /** Смены, если их нет в параметрах типа объекта: у аэропорта в датасете нет режима работы («3 × 8 ч» — PRD 10.1). */
  readonly schedule?: { readonly shiftsPerDay: number; readonly shiftHours: number }
}

export const LOCATION_SUMMARY_INPUTS: readonly LocationSummaryInputs[] = [
  { locationId: 'LOC-01', workersInProcesses: 145, parametersCompletenessPct: 78 },
  { locationId: 'LOC-02', workersInProcesses: 53, parametersCompletenessPct: 88 },
  { locationId: 'LOC-03', workersInProcesses: 180, parametersCompletenessPct: 97, schedule: { shiftsPerDay: 3, shiftHours: 8 } },
  { locationId: 'LOC-04', workersInProcesses: 111, parametersCompletenessPct: 96 },
]
