/** Отчёт PDF (экран 09, 16197:2318; PRD 11.6): печатный шаблон из 12 разделов (D-107). */
export const report = {
  documentTitle: (project: string) => `Отчёт · ${project}`,
  brand: 'RAV5',
  kind: 'Предварительная оценка',
  calculated: (date: string) => `Расчёт ${date}`,
  generated: (date: string) => `сформировано ${date}`,
  title: 'Оценка роботизации: обоснование выбранного решения',
  meta: (location: string, process: string, date: string, model: string, catalog: number) =>
    `${location} · ${process} · версия расчёта ${date} · модель ${model} · каталог v${String(catalog)}`,
  /** Колонтитул печати: «стр. 3 из 14» — `counter(page)` и `counter(pages)` в полях страницы. */
  page: { before: 'стр. ', between: ' из ' },
  toolbar: {
    label: 'Действия с отчётом',
    back: 'К итогу',
    print: 'Сохранить как PDF',
    saved: (date: string) => `Версия расчёта ${date} сохранена · «Сохранить как PDF» → печать → Сохранить в PDF`,
    draft: 'Черновик: цифры могут измениться · «Сохранить как PDF» → печать → Сохранить в PDF',
    guest: 'Демо-режим: оценка не сохраняется · «Сохранить как PDF» → печать → Сохранить в PDF',
  },
  loadError: { title: 'Не удалось собрать отчёт', message: 'Проверьте соединение и попробуйте ещё раз' },
  notFound: { title: 'Проект не найден', description: 'Возможно, его удалили или ссылка устарела', back: 'К проектам' },
  noSelection: { title: 'Вариант подбора не выбран', description: 'Отчёт строится по выбранному варианту. Выберите его на шаге «Подбор»', action: 'К подбору' },
  toc: 'Содержание отчёта',
  sections: {
    summary: 'Краткое заключение',
    task: 'Задача и текущий процесс',
    inputs: 'Исходные условия',
    variants: 'Рассмотренные варианты и метод выбора',
    config: 'Обоснование выбранной конфигурации',
    supply: 'Состав поставки и внедрения',
    economics: 'Экономическое сравнение',
    cashFlow: 'Денежный поток',
    simulation: 'Результаты симуляции',
    sensitivity: 'Чувствительность',
    assumptions: 'Допущения и следующие проверки',
    appendix: 'Приложения',
  },
  numbered: (n: number, title: string) => `${String(n)}. ${title}`,
  columns: { item: 'Показатель', value: 'Значение' },

  summary: {
    abstract: {
      process: (process: string, location: string, volume: string) => `Процесс проекта — «${process}» на локации ${location} (${volume}/сут).`,
      choice: (name: string, fleet: string) => `Выбран сценарий «${name}»: ${fleet}.`,
      money: (capex: string, effect: string, payback: string, horizon: string, roi: string) =>
        `Вложения при запуске ${capex}; чистый годовой эффект ${effect}; окупаемость ${payback}; ROI за ${horizon} ${roi}.`,
      conclusion: (title: string, explanation: string) => `${title}. ${explanation}.`,
      simulation: (served: string, required: string, onTime: string) => `Симуляция: в пик ${served} из ${required} рейсов/ч, в срок ${onTime} в худший день.`,
      noSimulation: 'Производительность симуляцией не проверялась.',
      alternative: (name: string, capex: string, effect: string, payback: string) =>
        `Альтернатива «${name}»: CAPEX ${capex}, эффект ${effect} в год, окупаемость ${payback}.`,
    },
    tco: (horizon: string, values: string) => `TCO за ${horizon}: ${values}`,
    tableCaption: 'Итог оценки на одной странице',
    rows: {
      subject: 'Предмет оценки',
      variant: 'Выбранный вариант',
      basis: 'Основание выбора',
      request: 'Что запрашивается сейчас',
      economics: 'Экономика',
      performance: 'Проверка производительности',
      tradeoff: 'Главный компромисс',
      conditions: 'Условия решения',
      status: 'Статус',
    },
    values: {
      subject: (process: string, location: string, volume: string, shifts: string) => `${process} · ${location} · ${volume}/сут · ${shifts}`,
      basis: (rank: string, score: string, recommended: boolean, top: string) =>
        [rank, score, recommended ? 'рекомендация системы' : null, top].filter(Boolean).join(' · '),
      score: (value: string) => `балл ${value}`,
      economics: (capex: string, effect: string, payback: string, horizon: string, tco: string) =>
        `CAPEX ${capex} · эффект ${effect} в год · окупаемость ${payback} · TCO за ${horizon} ${tco}`,
      performance: (runId: string, served: string, required: string, onTime: string) =>
        `Прогон ${runId}: в пик ${served} из ${required} рейсов/ч, в срок ${onTime} в худший день`,
      noRun: 'Симуляция не запускалась — производительность по расчёту подбора',
      cheaperStart: (name: string, capex: string, other: string, tco: string, horizon: string) =>
        `${name}: вложения ниже на ${capex}, но TCO за ${horizon} выше на ${tco}, чем у сценария «${other}»`,
      cheaperLong: (name: string, tco: string, other: string, capex: string, horizon: string) =>
        `${name}: TCO за ${horizon} ниже на ${tco}, но вложения выше на ${capex}, чем у сценария «${other}»`,
      dominates: (other: string) => `Сценарий не уступает «${other}» ни по вложениям, ни по TCO`,
      noAlternative: 'Альтернативного сценария нет',
      allConfirmed: 'Все условия подтверждены',
      saved: (conclusion: string, date: string) => `${conclusion} · оценка сохранена ${date}`,
      draft: (conclusion: string) => `${conclusion} · черновик`,
      guest: (conclusion: string) => `${conclusion} · демо, без сохранения`,
    },
  },

  task: {
    caption: 'Задача и текущий процесс',
    rows: {
      process: 'Процесс',
      location: 'Локация',
      volume: 'Объём в сутки',
      schedule: 'Режим работы',
      peak: 'Пиковый коэффициент',
      staff: 'Исполнители',
      salary: 'Оклад исполнителя',
      opex: 'Текущие расходы процесса в год',
      operation: 'Стоимость операции сейчас',
      tco: (horizon: string) => `TCO текущего процесса за ${horizon}`,
    },
    staff: (count: string, role: string) => `${count} · ${role}`,
    perMonth: (value: string) => `${value}/мес`,
  },

  inputs: {
    lead: 'Значения шага «Параметры» на дату снимка: из файла организатора, профиля локации, расчёта или допущения. Статус — у каждой строки',
    process: 'Параметры процесса',
    site: 'Параметры площадки, применимые к процессу',
  },

  variants: {
    lead: (total: string, passed: number, excluded: number) =>
      `Рассмотрено ${total}: прошли отбор ${String(passed)}, исключены жёсткими фильтрами ${String(excluded)}. Рейтинг — взвешенная сумма критериев`,
    ranking: 'Рейтинг вариантов',
    rankingCaption: 'Рейтинг вариантов подбора',
    columns: { rank: '№', solution: 'Решение · модель', robots: 'Роботов', capex: 'CAPEX', effect: 'Эффект в год', payback: 'Окупаемость', score: 'Балл', status: 'Статус' },
    statuses: { passed: 'прошло отбор', needs_verification: 'требует проверки', manual: 'добавлено вручную' },
    selected: 'выбран',
    outOfRank: 'вне рейтинга',
    weights: 'Критерии и веса',
    weightsCaption: 'Критерии рейтинга и их веса',
    weightColumns: { criterion: 'Критерий', weight: 'Вес', contribution: 'Вклад в балл выбранного варианта' },
    conditions: 'Условия отбора',
    conditionsCaption: 'Жёсткие условия отбора',
    conditionColumns: { condition: 'Условие', value: 'Требование', applicable: 'Применяется' },
    yes: 'да',
    no: 'нет',
    excluded: 'Исключённые решения',
    excludedCaption: 'Решения, не прошедшие жёсткие фильтры',
    excludedColumns: { solution: 'Решение', reasons: 'Причина исключения' },
    noExcluded: 'Исключённых решений нет',
  },

  config: {
    applicability: 'Матрица применимости',
    applicabilityCaption: (name: string) => `Проверки применимости: ${name}`,
    columns: { check: 'Проверка', requirement: 'Требование', result: 'Результат', note: 'Комментарий' },
    passedFilter: 'Вариант прошёл жёсткий фильтр подбора',
    siteCheck: (how: string) => `Условие площадки не подтверждено: ${how}`,
    checkStatuses: { pass: 'соответствует', fail: 'не соответствует', unknown: 'нет данных', not_applicable: 'не применяется' },
    noChecks: 'Расчёт не прислал проверок применимости',
    count: 'Расчёт количества',
    countLabel: 'Расчёт количества роботов и станций',
    plan: (checked: string, plan: string) => `Симуляция проверила ${checked}; принятый состав — ${plan}`,
  },

  supply: {
    equipment: 'Оборудование',
    equipmentCaption: 'Состав оборудования',
    columns: { item: 'Позиция', value: 'Количество и описание' },
    robots: 'Роботы',
    robotsValue: (count: string, name: string, manufacturer: string) => `${count} · ${name} · ${manufacturer}`,
    stations: 'Зарядные станции',
    noStations: 'расчёт не прислал',
    acquisition: 'Модель приобретения',
    costs: (name: string) => `Статьи CAPEX и OPEX · ${name}`,
  },

  economics: {
    lead: (volume: string, hours: string, horizon: string) => `Единые показатели для ${volume}/сут, ${hours} ч в сутки, горизонт ${horizon}`,
    caption: 'Экономическое сравнение сценариев',
    chain: (name: string) => `Из чего складываются затраты и эффект · ${name}`,
  },

  cashFlow: {
    lead: (horizon: string) => `Накопленный денежный поток без дисконтирования за ${horizon}, млн ₽: год 0 — минус вложения, дальше + годовой эффект`,
    label: 'Накопленный денежный поток по сценариям',
    breakEven: (name: string, text: string) => `${name}: ${text}`,
  },

  simulation: {
    none: 'Симуляция не запускалась: производительность оценена расчётом подбора. Проверить состав можно на шаге «Симуляция»',
    run: (id: string, title: string) => `Прогон ${id} · ${title}`,
    compare: 'Было → стало',
    compareCaption: 'Итоги проверенного и итогового состава',
    columns: { metric: 'Показатель', before: 'Проверенный состав', after: 'Итоговый состав' },
    rows: { fleet: 'Состав', peak: 'Пик, рейсов/ч', onTime: 'В срок в худший день', utilization: 'Загрузка парка в пик' },
    served: (served: string, required: string) => `${served} из ${required}`,
    load: 'Загрузка по часам · итоговый состав',
    time: 'Время роботов',
    frame: 'Кадр 2D-схемы · первый пиковый час',
    frameLoading: 'Загружаем 2D-схему…',
    frameError: 'Кадр 2D-схемы не загрузился — он есть на вкладке «Графики и 2D-сравнение»',
    frameCaption: (time: string) => `Положение роботов в ${time}`,
    risks: 'Риски прогона',
  },

  sensitivity: {
    lead: 'Три параметра ±20 % по каждому сценарию: как меняются окупаемость и TCO',
  },

  assumptions: {
    lead: 'Реестр условий решения: без подтверждения условий, отмеченных «держит вывод», вывод остаётся условным',
    scenario: 'Сценарий',
    blocks: 'держит вывод',
    both: 'оба',
    warnings: 'Замечания подбора',
  },

  appendix: {
    versions: 'Источники и версии',
    versionsCaption: 'Версии данных расчёта',
    rows: {
      snapshot: 'Снимок локации',
      catalog: 'Каталог решений',
      model: 'Расчётная модель',
      norms: 'Нормативы',
      run: 'Прогон симуляции',
      evaluation: 'Расчёт подбора',
      criteria: 'Критерии и веса',
    },
    norms: (version: number) => `v${String(version)}`,
    noNorms: 'до версий нормативов',
    sources: 'Демо-данные организатора по складу, каталог решений, характеристики производителей, нормативы и методика расчёта RAV5. Расчёт воспроизводится на указанных версиях снимка, каталога и модели',
    formulas: 'Формулы расчёта',
  },
} as const
