// Источник: PRD 11.1, таблица экрана «Проекты» (7 проектов); снимки сохранённых оценок — значения итога PRD 11.5 (№106).
// Правится вручную. Любое отступление от источника — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { Project } from '@/domain'

export const PROJECTS: readonly Project[] = [
  { id: "PJ-01", name: "Роботизация паллетного потока · РЦ Химки", locationId: "LOC-01", processIds: ["LP-01"], status: "saved", updatedAt: "2026-09-15T11:32:00Z", savedAt: "2026-09-15T11:32:00Z", result: { capexRub: 6100000, opexRubPerYear: 42000000, paybackYears: 0.7, annualEffectRub: 9200000 } },
  { id: "PJ-02", name: "Только уборка · РЦ Химки", locationId: "LOC-01", processIds: ["LP-04"], status: "draft", step: "params", updatedAt: "2026-09-14T15:05:00Z" },
  { id: "PJ-03", name: "Комплектация заказов · Даркстор Юг", locationId: "LOC-02", processIds: ["LP-07"], status: "saved", updatedAt: "2026-09-13T08:20:00Z", savedAt: "2026-09-13T08:20:00Z", result: { capexRub: 52400000, opexRubPerYear: 21300000, paybackYears: 1.6, annualEffectRub: null } },
  { id: "PJ-04", name: "Багаж терминала · Внуково-2", locationId: "LOC-03", processIds: ["LP-09"], status: "draft", step: "matching", updatedAt: "2026-09-12T09:00:00Z" },
  { id: "PJ-05", name: "Внутрибольничная логистика · ГКБ №17", locationId: "LOC-04", processIds: ["LP-12"], status: "saved", updatedAt: "2026-09-11T16:00:00Z", savedAt: "2026-09-11T16:00:00Z", result: { capexRub: 84000000, opexRubPerYear: 12500000, paybackYears: 7, annualEffectRub: null } },
  { id: "PJ-06", name: "Паллетный поток v2 · РЦ Химки", locationId: "LOC-01", processIds: ["LP-01"], status: "saved", updatedAt: "2026-09-10T10:00:00Z", savedAt: "2026-09-10T10:00:00Z", result: { capexRub: 47400000, opexRubPerYear: 34500000, paybackYears: 2.8, annualEffectRub: 16700000 } },
  { id: "PJ-07", name: "Инвентаризация · РЦ Химки", locationId: "LOC-01", processIds: ["LP-05"], status: "draft", step: "simulation", updatedAt: "2026-09-09T14:00:00Z" },
]
