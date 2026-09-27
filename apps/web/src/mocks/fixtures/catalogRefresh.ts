// Источник: макет А1а (16044:376) и PRD 6.2 — записанный заранее прогон опроса источников (ТЗ 4.2.7).
// Кадры идут по порядку: мок отдаёт следующий на каждый запрос статуса. Кадр 1 — состояние макета «2 из 3».
// Числа демонстрационные (PRD 15 · №2, №14, №54) — см. README.md и D-47.
import type { CatalogRefresh } from '@/domain'

const FC_BAS = { key: 'fc_bas_v5', label: 'ФЦ БАС · catalog_export_v5.csv' } as const
const RONAVI = { key: 'ronavi', label: 'Ронави Роботикс' } as const
const MINPROMTORG = { key: 'minpromtorg', label: 'Реестр Минпромторга' } as const

export const CATALOG_REFRESH_RUN: readonly CatalogRefresh[] = [
  { sources: [{ ...FC_BAS, status: 'waiting', received: null }, { ...RONAVI, status: 'queued', received: null }, { ...MINPROMTORG, status: 'queued', received: null }] },
  { sources: [{ ...FC_BAS, status: 'received', received: 12 }, { ...RONAVI, status: 'waiting', received: null }, { ...MINPROMTORG, status: 'queued', received: null }] },
  { sources: [{ ...FC_BAS, status: 'received', received: 12 }, { ...RONAVI, status: 'received', received: 4 }, { ...MINPROMTORG, status: 'waiting', received: null }] },
  // Реестра Минпромторга нет в реестре источников А6 (№54): в прогоне он не отвечает.
  { sources: [{ ...FC_BAS, status: 'received', received: 12 }, { ...RONAVI, status: 'received', received: 4 }, { ...MINPROMTORG, status: 'failed', received: null }] },
]
