// Источник: services/api/internal/seed/data/demo.yaml (задачи демо-локаций).
// Собрано однократно скриптом конвертации; дальше правится вручную. Любое отступление от источника — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { LocationProcess } from '@/domain'

export const LOCATION_PROCESSES: readonly LocationProcess[] = [
  { id: "LP-01", locationId: "LOC-01", processCode: "PR-0001", name: "Перемещение паллет", overrides: {}, workers: [] },
  { id: "LP-02", locationId: "LOC-01", processCode: "PR-0002", name: null, overrides: {}, workers: [] },
  { id: "LP-03", locationId: "LOC-01", processCode: "PR-0003", name: null, overrides: {"dailyVolume": 833}, workers: [] },
  { id: "LP-04", locationId: "LOC-01", processCode: "PR-0004", name: "Уборка склада", overrides: {}, workers: [] },
  { id: "LP-05", locationId: "LOC-01", processCode: "PR-0005", name: null, overrides: {}, workers: [] },
  { id: "LP-06", locationId: "LOC-02", processCode: "PR-0001", name: "Перемещение паллет", overrides: {"dailyVolume": 620}, workers: [] },
  { id: "LP-07", locationId: "LOC-02", processCode: "PR-0002", name: null, overrides: {}, workers: [] },
  { id: "LP-08", locationId: "LOC-02", processCode: "PR-0005", name: null, overrides: {}, workers: [] },
  { id: "LP-09", locationId: "LOC-03", processCode: "PR-0008", name: null, overrides: {}, workers: [] },
  { id: "LP-10", locationId: "LOC-03", processCode: "PR-0004", name: "Уборка терминала", overrides: {}, workers: [{"role": "Персонал терминала (логистика, уборка)", "timeShare": 0.4}] },
  { id: "LP-11", locationId: "LOC-03", processCode: "PR-0009", name: null, overrides: {}, workers: [] },
  { id: "LP-12", locationId: "LOC-04", processCode: "PR-0010", name: null, overrides: {}, workers: [] },
  { id: "LP-13", locationId: "LOC-04", processCode: "PR-0011", name: null, overrides: {}, workers: [] },
  { id: "LP-14", locationId: "LOC-04", processCode: "PR-0012", name: null, overrides: {}, workers: [] },
  { id: "LP-15", locationId: "LOC-04", processCode: "PR-0004", name: "Уборка коридоров", overrides: {}, workers: [{"role": "Санитары и транспортировщики", "timeShare": 0.2}] },
]
