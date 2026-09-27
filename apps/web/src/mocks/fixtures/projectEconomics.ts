// Источник: PRD 11.5 «Устойчивость результата» и «Условия решения и что проверить» (AMR 800 · RaaS).
// В API этих блоков нет (ни в Evaluation, ни отдельным эндпоинтом) — форма экрана, вопрос в apps/web/docs/api-contract.md.
// Для покупки и текущего процесса чисел устойчивости в PRD нет. Правится вручную.
import type { ConditionRow, SensitivityRow } from '@/domain'

const M = 1_000_000

export const SENSITIVITY_LP01_RAAS: readonly SensitivityRow[] = [
  { parameter: 'Тариф RaaS', base: '46 тыс. ₽/робот/мес', paybackYears: { minus20: 0.5, plus20: 0.8 }, tcoRub: { minus20: 206.2 * M, plus20: 226 * M }, note: 'Предпочтение по TCO меняется на покупку' },
  { parameter: 'Стоимость труда', base: '120 000 ₽/мес', paybackYears: { minus20: 1, plus20: 0.5 }, tcoRub: { minus20: 185.9 * M, plus20: 246.3 * M }, note: 'Эффект положителен, предпочтение сохраняется' },
  { parameter: 'Объём операций', base: '2 000 паллет/сут', paybackYears: { minus20: 0.8, plus20: 0.6 }, tcoRub: { minus20: 177.3 * M, plus20: 257.7 * M }, note: 'Парк 15 / 22; эффект положителен, предпочтение сохраняется' },
]

const RAAS = 'AMR 800 · RaaS'

export const CONDITIONS_LP01_RAAS: readonly ConditionRow[] = [
  { parameter: 'Допустимая нагрузка на пол', value: '—', status: 'no_data', source: 'профиль локации', scenario: RAAS, impact: 'Масса робота с грузом должна укладываться в допустимую нагрузку. До проверки вывод условный', howToConfirm: 'Паспорт здания или акт обследования перекрытий, до пилота' },
  { parameter: 'Покрытие Wi-Fi на маршрутах', value: '—', status: 'needs_check', source: 'профиль локации', scenario: RAAS, impact: 'Без устойчивой связи AMR 800 останавливается; может понадобиться больше точек доступа — затраты на связь вырастут', howToConfirm: 'Радиообследование маршрута при обследовании' },
  { parameter: 'Интеграция с WMS', value: '—', status: 'no_data', source: 'нет данных о версии и API', scenario: RAAS, impact: 'Без интеграции задания выдаются вручную; глубокая интеграция не в цене — бюджет неполный', howToConfirm: 'Запрос ИТ-службе и производителю' },
  { parameter: 'Характеристики по аналогу', value: 'скорость, точность', status: 'assumption', source: 'аналог того же класса', scenario: RAAS, impact: 'Скорость с грузом влияет на цикл: ±1 робот', howToConfirm: 'Технический паспорт производителя' },
  { parameter: 'Тариф RaaS', value: '46 000 ₽', status: 'assumption', source: 'расчётный сценарий', scenario: RAAS, impact: 'При +20 % окупаемость RaaS 0,8 года', howToConfirm: 'Коммерческое предложение производителя' },
  { parameter: 'Доставка, интеграция, обучение', value: '—', status: 'no_data', source: 'не в прайсе', scenario: RAAS, impact: 'Бюджет вложений неполный', howToConfirm: 'Предложения поставщиков и интегратора' },
  { parameter: 'Экономия на персонале', value: '≈ 9 ставок', status: 'assumption', source: 'механизм не подтверждён', scenario: RAAS, impact: 'Без сокращения или незамещения эффект ниже на 16,7 млн ₽', howToConfirm: 'Решение HR и руководителя смены' },
]

/** Операций в сутки у процесса LP-01 — для стоимости операции (PRD 11.2, группа Б). */
export const OPERATIONS_PER_DAY_LP01 = 2000
