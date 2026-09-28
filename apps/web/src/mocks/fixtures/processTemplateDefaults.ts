// Значения по умолчанию формы 09а: макет 15935:903 и подсказка секции 4 (PRD 9.2).
// Коэффициенты без норматива (PRD 15 · №22) — здесь, пока их нет в справочнике нормативов А5.
import type { ProcessDemoText, ProcessTemplateDefaults } from '@/domain'

export const PROCESS_TEMPLATE_DEFAULTS: ProcessTemplateDefaults = {
  /** Вилы и платформа — из PR-0001, остальные — подсказка секции 4 макета. */
  replacement: {
    forks: 0.8,
    platform: 0.6,
    tow: 0.8,
    body: 0.5,
    manipulator: 0.5,
    brushes: 0.7,
  },
  speedLimitMps: 1.5,
  widthMarginM: 0.6,
  liftTripPct: 0,
  liftWaitS: 0,
  minTempC: 5,
  turnoverPct: 0,
  fleetOperators: 1,
  sitePrepPct: 5,
  itIntegrationRub: 2_000_000,
  consumablesRub: 0,
  otherEffectsRub: 0,
}

/** Пример заполнения формы 09а: «Перемещение паллет · кросс-докинг» на значениях демо-склада (PRD 9.2). */
export const PROCESS_DEMO_TEXT: ProcessDemoText = {
  name: 'Перемещение паллет · кросс-докинг',
  carrier: 'Паллета на полу',
  route: 'Приёмка → зона хранения → отгрузка',
}
