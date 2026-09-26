import type { DashboardInputs } from '@/domain'

/** Данные дашборда, которых нет в сервисах проектов и локаций (PRD 8). */
export interface DashboardService {
  getInputs(): Promise<DashboardInputs>
}
