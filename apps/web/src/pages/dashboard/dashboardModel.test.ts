import { describe, expect, it } from 'vitest'
import type { Project } from '@/domain'
import { emptyInputs } from '@/domain'
import { DASHBOARD_INPUTS } from '@/mocks/fixtures/dashboard'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { buildDashboard, foundSavingsRub } from './dashboardModel'

const BASE = {
  locationId: 'LOC-01',
  versions: { snapshotAt: '2026-09-15', catalog: 4, model: '2.1', norms: 3 },
  inputs: emptyInputs('2026-09-15T11:32:00Z'),
} as const

const project = (id: string, processId: string, annualEffectRub: number | null): Project => ({
  ...BASE,
  id: `PJ-${id}`,
  name: id,
  locationProcessId: `LP-${processId}`,
  status: 'saved',
  updatedAt: '2026-09-15T11:32:00Z',
  savedAt: '2026-09-15T11:32:00Z',
  result: { capexRub: 1, opexRubPerYear: 1, paybackYears: 1, annualEffectRub },
})

describe('foundSavingsRub (PRD 8.2: лучший проект на каждый процесс)', () => {
  it('takes the best project of a process once', () => {
    expect(foundSavingsRub([project('a', '01', 5), project('b', '01', 9)])).toBe(9)
  })

  it('sums projects over different processes', () => {
    expect(foundSavingsRub([project('a', '01', 5), project('b', '02', 9)])).toBe(14)
  })

  it('ignores projects without an annual effect', () => {
    expect(foundSavingsRub([project('a', '01', null)])).toBe(0)
  })

  it('ignores drafts: their numbers are not saved yet (PRD 11.1)', () => {
    const draft: Project = { ...BASE, id: 'PJ-d', name: 'd', locationProcessId: 'LP-02', status: 'draft', step: 'economics', updatedAt: '2026-09-15T11:32:00Z' }
    expect(foundSavingsRub([draft, project('a', '01', 5)])).toBe(5)
  })
})

describe('buildDashboard on the demo fixtures', () => {
  const dashboard = buildDashboard({ locations: LOCATIONS, projects: PROJECTS, inputs: DASHBOARD_INPUTS })

  it('counts locations and lists their facility types once, in order', () => {
    expect(dashboard.locationCount).toBe(4)
    expect(dashboard.facilityTypes).toEqual(['warehouse', 'airport', 'medical'])
  })

  it('counts projects and saved assessments (PRD 8.2)', () => {
    expect(dashboard.projectCount).toBe(7)
    expect(dashboard.calculatedCount).toBe(4)
  })

  it('finds savings by the best saved project of each process: v2 purchase beats RaaS on LP-01', () => {
    expect(dashboard.savingsRub).toBe(16_700_000)
  })

  it('sums manual labor over all locations, not only the visible ones (PRD 15 · 12)', () => {
    expect(dashboard.manualLaborRub).toBe(591_000_000)
  })

  it('shows the three most recent projects with their location', () => {
    expect(dashboard.recentProjects.map((p) => p.project.id)).toEqual(['PJ-01', 'PJ-02', 'PJ-03'])
    expect(dashboard.recentProjects[2]?.locationName).toBe('Даркстор Юг')
  })

  it('shows three locations with labor cost and computed project count', () => {
    expect(dashboard.locations.map((l) => [l.location.name, l.laborRub, l.projectCount])).toEqual([
      ['РЦ Химки', 231_000_000, 4],
      ['Даркстор Юг', 84_000_000, 1],
      ['Терминал Внуково-2', 183_000_000, 1],
    ])
  })

  it('passes the checks through', () => {
    expect(dashboard.checks.total).toBe(8)
  })

  it('shows no labor cost for a location missing from the inputs', () => {
    const partial = buildDashboard({ locations: LOCATIONS, projects: [], inputs: { ...DASHBOARD_INPUTS, laborCosts: [] } })
    expect(partial.locations[0]?.laborRub).toBeNull()
    expect(partial.manualLaborRub).toBe(0)
  })
})
