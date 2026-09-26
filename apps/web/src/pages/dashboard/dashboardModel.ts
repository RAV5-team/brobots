import type { DashboardChecks, DashboardInputs, FacilityTypeCode, Location, LocationProcessId, Project } from '@/domain'

/** Сколько строк помещается в блоки «Продолжить» и «Локации» на 1366×768 (экран 06, PRD 8.3). */
export const RECENT_PROJECTS_LIMIT = 3
export const DASHBOARD_LOCATIONS_LIMIT = 3

export interface RecentProject {
  readonly project: Project
  readonly locationName: string
}

export interface DashboardLocation {
  readonly location: Location
  /** null — стоимость ручной работы по локации ещё не посчитана. */
  readonly laborRub: number | null
  readonly projectCount: number
}

export interface Dashboard {
  readonly locationCount: number
  readonly facilityTypes: readonly FacilityTypeCode[]
  readonly projectCount: number
  readonly calculatedCount: number
  readonly manualLaborRub: number
  readonly savingsRub: number
  readonly checks: DashboardChecks
  readonly recentProjects: readonly RecentProject[]
  readonly locations: readonly DashboardLocation[]
}

interface DashboardSources {
  readonly locations: readonly Location[]
  /** Сначала недавно изменённые — так их отдаёт ProjectService. */
  readonly projects: readonly Project[]
  readonly inputs: DashboardInputs
}

/** Проект рассчитан, когда дошёл до итога и экономики: статус «Результат» (PRD 8.2, D-29). */
const isCalculated = (project: Project): boolean => project.step === 'economics'

/**
 * Найденная экономия (PRD 8.2): у каждого процесса — лучший проект, и ни один процесс не считается дважды.
 * Эффект проекта на процессы не делится, поэтому берём проекты по убыванию эффекта и пропускаем те,
 * чьи процессы уже покрыты более выгодным проектом.
 */
export function foundSavingsRub(projects: readonly Project[]): number {
  const withEffect = projects
    .map((p) => ({ processIds: p.processIds, effect: p.preliminary?.annualEffectRub ?? null }))
    .filter((p): p is { processIds: readonly LocationProcessId[]; effect: number } => p.effect !== null)
    .sort((a, b) => b.effect - a.effect)

  const { total } = withEffect.reduce<{ covered: ReadonlySet<LocationProcessId>; total: number }>(
    (acc, p) =>
      p.processIds.some((id) => acc.covered.has(id))
        ? acc
        : { covered: new Set([...acc.covered, ...p.processIds]), total: acc.total + p.effect },
    { covered: new Set(), total: 0 },
  )
  return total
}

/** Всё, что показывает дашборд, из сервисов: счётчики и суммы вычисляются, а не хранятся (D-13). */
export function buildDashboard({ locations, projects, inputs }: DashboardSources): Dashboard {
  const laborByLocation = new Map(inputs.laborCosts.map((c) => [c.locationId, c.annualRub]))
  const locationNames = new Map(locations.map((l) => [l.id, l.name]))

  return {
    locationCount: locations.length,
    facilityTypes: [...new Set(locations.map((l) => l.facilityType))],
    projectCount: projects.length,
    calculatedCount: projects.filter(isCalculated).length,
    manualLaborRub: inputs.laborCosts.reduce((sum, c) => sum + c.annualRub, 0),
    savingsRub: foundSavingsRub(projects),
    checks: inputs.checks,
    recentProjects: projects.slice(0, RECENT_PROJECTS_LIMIT).map((project) => ({
      project,
      locationName: locationNames.get(project.locationId) ?? '',
    })),
    locations: locations.slice(0, DASHBOARD_LOCATIONS_LIMIT).map((location) => ({
      location,
      laborRub: laborByLocation.get(location.id) ?? null,
      projectCount: projects.filter((p) => p.locationId === location.id).length,
    })),
  }
}
