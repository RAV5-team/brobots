// Источник: экран 06 «Дашборд» (три проекта блока «Продолжить») и services/api/internal/seed/data/demo.yaml (Внуково-2, ГКБ №17).
// Собрано однократно скриптом конвертации; дальше правится вручную. Любое отступление от источника — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { Project } from '@/domain'

export const PROJECTS: readonly Project[] = [
  { id: "PJ-01", name: "Роботизация паллетного потока · РЦ Химки", locationId: "LOC-01", processIds: ["LP-01"], status: "draft", step: "economics", updatedAt: "2026-09-15T11:32:00Z", preliminary: {"paybackYears": 0.7, "annualEffectRub": 9200000} },
  { id: "PJ-02", name: "Только уборка · РЦ Химки", locationId: "LOC-01", processIds: ["LP-04"], status: "draft", step: "params", updatedAt: "2026-09-14T15:05:00Z", preliminary: null },
  { id: "PJ-03", name: "Комплектация и инвентаризация · Даркстор Юг", locationId: "LOC-02", processIds: ["LP-07", "LP-08"], status: "draft", step: "simulation", updatedAt: "2026-09-13T08:20:00Z", preliminary: {"paybackYears": 2.2, "annualEffectRub": null} },
  { id: "PJ-04", name: "Роботизация перемещения багажа · Внуково-2", locationId: "LOC-03", processIds: ["LP-09"], status: "draft", step: "matching", updatedAt: "2026-09-12T09:00:00Z", preliminary: null },
  { id: "PJ-05", name: "Доставка питания роботами · ГКБ №17", locationId: "LOC-04", processIds: ["LP-12"], status: "draft", step: "matching", updatedAt: "2026-09-12T09:00:00Z", preliminary: null },
]
