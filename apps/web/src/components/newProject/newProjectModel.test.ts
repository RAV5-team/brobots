import { describe, expect, it } from 'vitest'
import { DASHBOARD_INPUTS } from '@/mocks/fixtures/dashboard'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { createMockServices } from '@/services/mock'
import { isNewProjectOpen, locationChoices, parseNewProjectContext, withNewProject, withoutNewProject } from './newProjectModel'

const params = (search: string) => new URLSearchParams(search)

describe('newProjectModel', () => {
  it('opens only on new=1 and drops foreign ids from the context', () => {
    expect(isNewProjectOpen(params('?new=1'))).toBe(true)
    expect(isNewProjectOpen(params('?new=yes'))).toBe(false)
    expect(parseNewProjectContext(params('?new=1&solution=RB-0008&locationId=LOC-02&locationProcessId=LP-06')))
      .toEqual({ solutionId: 'RB-0008', locationId: 'LOC-02', locationProcessId: 'LP-06' })
    expect(parseNewProjectContext(params('?new=1&locationId=<script>&locationProcessId=x'))).toEqual({})
  })

  it('adds and removes the dialog parameters, keeping the page ones', () => {
    expect(withNewProject(params('?q=amr&new=1&solution=OLD'), { solutionId: 'RB-0008' })).toBe('?q=amr&new=1&solution=RB-0008')
    expect(withoutNewProject(params('?q=amr&new=1&locationId=LOC-01&locationProcessId=LP-01&solution=X')).toString()).toBe('q=amr')
  })

  it('sums the rows to the dashboard «Ручная работа на локациях» (PRD 8.2)', async () => {
    const summaries = await createMockServices({ latencyMs: 0 }).locations.listLocationSummaries()
    const rows = locationChoices(LOCATIONS, summaries)
    const total = DASHBOARD_INPUTS.laborCosts.reduce((sum, c) => sum + c.annualRub, 0)
    const shown = summaries.reduce((sum, s) => sum + (s.laborCostRubYear ?? 0), 0)
    expect(shown).toBe(total)
    expect(total).toBe(591_000_000)
    expect(rows.map((r) => r.labor.replace(/[\s\u2060]+/g, ' '))).toEqual(['231 млн ₽/год', '84 млн ₽/год', '183 млн ₽/год', '93 млн ₽/год'])
  })

  it('shows a dash for a new location without processes or profile values', () => {
    const [first] = LOCATIONS
    if (!first) throw new Error('Нет демо-локаций')
    const row = locationChoices([{ ...first, id: 'LOC-05', parameters: {} }], [])[0]
    expect(row).toMatchObject({ area: '—', staff: '—', labor: '—' })
  })
})
