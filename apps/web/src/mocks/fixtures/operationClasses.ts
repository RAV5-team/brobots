// Источник: services/api/internal/seed/data/reference.yaml (экран А8, PRD 6.7).
// Собрано однократно скриптом конвертации; дальше правится вручную. Любое отступление от источника — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { HandlingMethod, OperationClass } from '@/domain'

export const OPERATION_CLASSES: readonly OperationClass[] = [
  { code: "OP-01", name: "Перемещение грузов", description: "Паллеты, тележки и короба между зонами объекта", unit: "ед. груза", workCategory: "internal_logistics", typicalCarriers: ["паллета", "тележка", "багажная тележка", "короб"], exampleProcesses: ["Перемещение паллет", "Перемещение багажа"] },
  { code: "OP-02", name: "Комплектация заказов", description: "Отбор товара по строкам заказа", unit: "строк", workCategory: "fulfillment", typicalCarriers: ["мобильный стеллаж", "короб"], exampleProcesses: ["Комплектация заказов"] },
  { code: "OP-03", name: "Сортировка", description: "Распределение отправлений по направлениям", unit: "отправлений", workCategory: "fulfillment", typicalCarriers: ["отправление", "посылка"], exampleProcesses: ["Сортировка грузов"] },
  { code: "OP-04", name: "Хранение и выдача", description: "Автоматические склады, шаттлы, стеллажи, подъём на ярус", unit: "операций", workCategory: "internal_logistics", typicalCarriers: ["паллета", "контейнер"], exampleProcesses: ["Подъём паллет на ярус"] },
  { code: "OP-05", name: "Упаковка и паллетирование", description: "Упаковочные линии и паллетайзеры", unit: "заказов", workCategory: "fulfillment", typicalCarriers: ["заказ", "короб"], exampleProcesses: ["Упаковка"] },
  { code: "OP-06", name: "Инвентаризация", description: "Пересчёт и контроль мест хранения", unit: "паллетомест", workCategory: "accounting_control", typicalCarriers: ["паллетоместо"], exampleProcesses: ["Инвентаризация"] },
  { code: "OP-07", name: "Уборка помещений", description: "Сухая и влажная уборка твёрдых покрытий", unit: "м²", workCategory: "facility_maintenance", typicalCarriers: ["твёрдое покрытие"], exampleProcesses: ["Уборка помещений", "Уборка терминала"] },
  { code: "OP-08", name: "Адресная доставка", description: "Доставка по точкам маршрута внутри объекта", unit: "рейсов", workCategory: "internal_logistics", typicalCarriers: ["тележка с питанием", "контейнер с бельём", "контейнер с пробами"], exampleProcesses: ["Доставка питания по отделениям", "Транспорт белья", "Доставка биоматериалов", "Доставка бортпитания"] },
  { code: "OP-09", name: "Охрана и патрулирование", description: "Обходы по маршруту, видеоаналитика", unit: "обходов", workCategory: "security", typicalCarriers: ["маршрут обхода"], exampleProcesses: ["Патрулирование и охрана"] },
  { code: "OP-10", name: "Мониторинг и инспекция", description: "Осмотр и контроль состояния", unit: "обходов", workCategory: "accounting_control", typicalCarriers: ["объект осмотра"], exampleProcesses: ["Инспекция оборудования"] },
]

export const HANDLING_METHODS: readonly HandlingMethod[] = [
  { code: "forks", name: "Вилы", hint: "FMR, штабелёры" },
  { code: "platform", name: "Платформа", hint: "подъёмный AMR" },
  { code: "tow", name: "Буксировка", hint: "тягачи" },
  { code: "body", name: "Кузов", hint: "грузовики, доставщики" },
  { code: "manipulator", name: "Манипулятор", hint: "коботы, роборуки" },
  { code: "brushes", name: "Щётки", hint: "уборка" },
  { code: "none", name: "Без груза", hint: "инвентаризация, патрулирование" },
]
