import { describe, expect, it } from 'vitest'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { projectOpenPath } from './routePaths'

const byId = (id: string) => {
  const project = PROJECTS.find((p) => p.id === id)
  if (!project) throw new Error(id)
  return project
}

describe('projectOpenPath', () => {
  it('opens a draft on the step where it stopped', () => {
    expect(projectOpenPath(byId('PJ-02'))).toBe('/projects/PJ-02/params')
    expect(projectOpenPath(byId('PJ-04'))).toBe('/projects/PJ-04/matching')
  })

  it('opens a saved assessment read-only (D-17)', () => {
    expect(projectOpenPath(byId('PJ-01'))).toBe('/projects/PJ-01/result')
  })
})
