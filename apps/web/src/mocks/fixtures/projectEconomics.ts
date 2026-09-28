// Источник: PRD 11.5 «Условия решения и что проверить» (AMR 800). Устойчивость считается в домене (economicsModel).
// В API реестра нет (ни в Evaluation, ни отдельным эндпоинтом) — форма экрана, вопрос в apps/web/docs/api-contract.md.
// Тариф RaaS относится только к RaaS; пол, Wi-Fi и WMS держат вывод условным (PRD 11.5). Правится вручную.
import type { ConditionRow } from '@/domain'

export const CONDITIONS_LP01: readonly ConditionRow[] = [
  { parameter: 'Допустимая нагрузка на пол', value: '—', status: 'no_data', source: 'профиль локации', acquisition: null, blocksConclusion: true, impact: 'Масса робота с грузом должна укладываться в допустимую нагрузку. До проверки вывод условный', howToConfirm: 'Паспорт здания или акт обследования перекрытий, до пилота' },
  { parameter: 'Покрытие Wi-Fi на маршрутах', value: '—', status: 'needs_check', source: 'профиль локации', acquisition: null, blocksConclusion: true, impact: 'Без устойчивой связи AMR 800 останавливается; может понадобиться больше точек доступа — затраты на связь вырастут', howToConfirm: 'Радиообследование маршрута при обследовании' },
  { parameter: 'Интеграция с WMS', value: '—', status: 'no_data', source: 'нет данных о версии и API', acquisition: null, blocksConclusion: true, impact: 'Без интеграции задания выдаются вручную; глубокая интеграция не в цене — бюджет неполный', howToConfirm: 'Запрос ИТ-службе и производителю' },
  { parameter: 'Характеристики по аналогу', value: 'скорость, точность', status: 'assumption', source: 'аналог того же класса', acquisition: null, blocksConclusion: false, impact: 'Скорость с грузом влияет на цикл: ±1 робот', howToConfirm: 'Технический паспорт производителя' },
  { parameter: 'Тариф RaaS', value: '46 000 ₽', status: 'assumption', source: 'расчётный сценарий', acquisition: 'raas', blocksConclusion: false, impact: 'При +20 % окупаемость RaaS 0,8 года', howToConfirm: 'Коммерческое предложение производителя' },
  { parameter: 'Доставка, интеграция, обучение', value: '—', status: 'no_data', source: 'не в прайсе', acquisition: null, blocksConclusion: false, impact: 'Бюджет вложений неполный', howToConfirm: 'Предложения поставщиков и интегратора' },
  { parameter: 'Экономия на персонале', value: '≈ 9 ставок', status: 'assumption', source: 'механизм не подтверждён', acquisition: null, blocksConclusion: false, impact: 'Без сокращения или незамещения эффект ниже на 16,7 млн ₽', howToConfirm: 'Решение HR и руководителя смены' },
]

/** Операций в сутки у процесса LP-01 — для стоимости операции (PRD 11.2, группа Б). */
export const OPERATIONS_PER_DAY_LP01 = 2000
