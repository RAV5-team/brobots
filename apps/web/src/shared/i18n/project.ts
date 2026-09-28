import type { SimulationStage } from '@/domain'

/**
 * Шаги проекта-оценки (PRD 11; секция 15877:2). Часть словаря `ru` — вынесена, чтобы ru.ts не рос.
 * Короткие стадии и заголовки шагов — `ru.projectStages`, `ru.projectStepTitles`.
 */
export const project = {
  stepsNav: 'Шаги проекта',
  params: {
    processChoice: 'Процесс проекта',
    readyToMatch: 'Готово к расчёту',
    missingValues: (count: number) => `Не хватает ${String(count)} параметров`,
  },
  matching: {
    operationCost: 'Стоимость операции',
    perPallet: 'на паллету',
    previous: (value: string) => `было ${value}`,
    howCalculated: 'Как рассчитано',
    howCalculatedLead: (solution: string, process: string) => `${solution} для процесса «${process}». Пошаговый расчёт: от потребности до окупаемости`,
    formulasAndSources: 'Формулы и источники',
    understood: 'Понятно',
    fleetStep: 'Цикл и парк',
  },
  simulation: {
    stagesNav: 'Этапы симуляции',
    stages: {
      scope: '1. Что проверяем',
      conditions: '2. Условия симуляции',
      run: '3. Прогон',
      verdict: '4. Вердикт',
    } satisfies Record<SimulationStage, string>,
    fleet: {
      title: 'Состав для проверки',
      robots: 'Роботов',
      stations: 'Зарядных станций',
      previous: (count: number) => `было ${String(count)} · из подбора`,
      perStation: (robots: number) => `1 станция на ${String(robots)} робота`,
    },
    hourly: {
      caption: 'Что происходило по часам',
      hour: 'Час',
      demand: 'Потребность, рейсов',
      done: 'Выполнено, рейсов',
      onTime: 'Паллет в срок, %',
    },
  },
} as const
