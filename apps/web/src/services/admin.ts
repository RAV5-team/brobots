import type { DataSource } from '@/domain'

/** Администрирование: источники данных (PRD 6.9). */
export interface AdminService {
  listDataSources(): Promise<readonly DataSource[]>
}
