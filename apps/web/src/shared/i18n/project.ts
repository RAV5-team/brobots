import type { SimulationStage } from '@/domain'

/**
 * Шаги проекта-оценки (PRD 11; секция 15877:2). Часть словаря `ru` — вынесена, чтобы ru.ts не рос.
 * Короткие стадии и заголовки шагов — `ru.projectStages`, `ru.projectStepTitles`.
 */
export const project = {
  stepsNav: 'Шаги проекта',
  crumbsNav: 'Путь к проекту',
  /** Сохранённая оценка открывается только для просмотра (D-17). */
  readOnly: 'Оценка готова · только просмотр',
  page: {
    documentTitle: (step: string, project: string) => `${step} · ${project} · RAV5`,
    notFound: { title: 'Проект не найден', description: 'Возможно, его удалили или ссылка устарела', back: 'К списку проектов' },
    error: { title: 'Не удалось открыть проект', message: 'Проверьте соединение и попробуйте ещё раз' },
    /** Тело шага до экранов 02–08 (пункт 6 плана): каркас уже настоящий. */
    pending: { title: 'Экран шага собирается', description: 'Каркас шага готов: путь, шаги и данные проекта. Содержание — по секции Figma 15877:2 и PRD 11' },
  },
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
