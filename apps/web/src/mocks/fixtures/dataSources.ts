// Источник: services/api/internal/seed/data/reference.yaml (экран А6).
// Собрано однократно скриптом конвертации; дальше правится вручную. Любое отступление от источника — строкой в README.md.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { DataSource } from '@/domain'

export const DATA_SOURCES: readonly DataSource[] = [
  { key: "catalog_v4", name: "Каталог ФЦ БАС · catalog_export_v4", kind: "catalog", origin: "organizer", locator: {"kind": "file", "fileName": "catalog_export_v4.csv"}, status: "confirmed", provides: "223 строки · 187 решений · цены с НДС", actualizedOn: "2026-08-12T00:00:00Z", refresh: "manual" },
  { key: "catalog_pdf", name: "Каталог внедрения ФЦ БАС · PDF", kind: "cases", origin: "organizer", locator: {"kind": "file", "fileName": "ФЦ БАС — Каталог внедрения 2008 1247.pdf"}, status: "confirmed", provides: "фото, кейсы, УГТ, значки «Протестировано ФЦ БАС» и «Есть в 719»", actualizedOn: "2026-08-12T00:00:00Z", refresh: "manual" },
  { key: "examples", name: "Примеры решений · типы объектов", kind: "specs", origin: "organizer", locator: {"kind": "file", "fileName": "Примеры_решений_типы_объектов.docx"}, status: "confirmed", provides: "ТТХ 8 моделей-примеров", actualizedOn: "2026-09-15T00:00:00Z", refresh: "manual" },
  { key: "vendor_sites", name: "Официальные сайты производителей", kind: "specs", origin: "open", locator: {"kind": "url", "url": "https://ronavi-robotics.ru/catalogue"}, status: "estimate", provides: "ТТХ демо-роботов, дополненные по аналогам", actualizedOn: "2026-09-19T00:00:00Z", refresh: "monthly" },
  { key: "datasets", name: "Демо-датасеты объектов", kind: "dataset", origin: "organizer", locator: {"kind": "file", "fileName": "Датасеты_хакатон.xlsx"}, status: "confirmed", provides: "склад · аэропорт · медучреждение", actualizedOn: "2026-09-15T00:00:00Z", refresh: "manual" },
  { key: "startup_items", name: "Позиции для запуска · оценка команды RAV5", kind: "prices", origin: "internal", locator: null, status: "estimate", provides: "29 позиций инфраструктуры, ПО, внедрения и поддержки", actualizedOn: "2026-09-19T00:00:00Z", refresh: "manual" },
]
