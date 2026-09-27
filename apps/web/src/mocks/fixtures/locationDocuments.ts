// Источник: PRD 10.3, таблица «Экран 17б · документы» (16005:1024). В demo.yaml документов нет.
// Файлы к демо-документам не приложены — url: null (D-42).
import type { LocationDocument } from '@/domain'

export const LOCATION_DOCUMENTS: readonly LocationDocument[] = [
  {
    id: 'DOC-01',
    locationId: 'LOC-01',
    name: 'План склада, этаж 1.dwg',
    extension: 'dwg',
    kind: 'cad',
    fileCount: 1,
    uploadedAt: '2026-09-12T09:00:00Z',
    url: null,
  },
  {
    id: 'DOC-02',
    locationId: 'LOC-01',
    name: 'Фото зоны приёмки.jpg',
    extension: 'jpg',
    kind: 'photo',
    fileCount: 10,
    uploadedAt: '2026-09-10T09:00:00Z',
    url: null,
  },
  {
    id: 'DOC-03',
    locationId: 'LOC-01',
    name: 'Обследование объекта.xlsx',
    extension: 'xlsx',
    kind: 'excel',
    fileCount: 1,
    uploadedAt: '2026-09-14T09:00:00Z',
    url: null,
  },
  {
    id: 'DOC-04',
    locationId: 'LOC-01',
    name: 'Схема зон и маршрутов.pdf',
    extension: 'pdf',
    kind: 'scheme',
    fileCount: 1,
    uploadedAt: '2026-09-14T09:00:00Z',
    url: null,
  },
]
