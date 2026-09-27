import { describe, expect, it } from 'vitest'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { projectOpenPath, projectStepPath } from './routePaths'

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

  it('opens a saved assessment on the result step, read-only (D-17): one route for the result', () => {
    expect(projectOpenPath(byId('PJ-01'))).toBe('/projects/PJ-01/economics')
  })
})

describe('projectStepPath', () => {
  it('builds the path of a step by ProjectStep', () => {
    expect(projectStepPath('PJ-DEMO', 'params')).toBe('/projects/PJ-DEMO/params')
    expect(projectStepPath('PJ-DEMO', 'economics')).toBe('/projects/PJ-DEMO/economics')
  })
})
