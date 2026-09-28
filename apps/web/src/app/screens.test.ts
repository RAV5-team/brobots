import { describe, expect, it } from 'vitest'
import { FIGMA_FILE_KEY, SCREENS, figmaUrl, samplePath, screensByRoute } from './screens'
import { ROUTE_PATHS } from './routePaths'

describe('SCREENS registry', () => {
  it('has unique ids', () => {
    const ids = SCREENS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('maps every routed screen to a known route path', () => {
    const known = new Set<string>(Object.values(ROUTE_PATHS))
    const unknown = SCREENS.filter((s) => s.route !== null && !known.has(s.route))
    expect(unknown).toEqual([])
  })

  it('gives every route path at least one screen', () => {
    const routed = new Set(SCREENS.map((s) => s.route))
    const empty = Object.values(ROUTE_PATHS).filter((p) => !routed.has(p))
    expect(empty).toEqual([])
  })

  it('uses Figma node ids in "<a>:<b>" form and never the whole dev section', () => {
    for (const s of SCREENS) {
      if (s.nodeId === null) continue
      expect(s.nodeId).toMatch(/^\d+:\d+$/)
      expect(s.nodeId).not.toBe('15935:2')
    }
  })

  it('includes the clean-series screens from screens.md', () => {
    const clean = SCREENS.filter((s) => s.series === 'clean').map((s) => s.code)
    expect(clean).toEqual([
      '05', '06', '07', '09а', '11',
      '12', '12а', '14', '15', '15а', '16', '17', '17а', '17б', '17в',
      'А1', 'А1а', 'А2', 'А3', 'А5', 'А6', 'А7', 'А7б', 'А8', 'А10',
      'К-1', 'К-2', 'К-3', 'К-4',
    ])
  })
})

describe('figmaUrl', () => {
  it('builds a link to the node in the RAV5 file', () => {
    expect(figmaUrl('15935:115')).toBe(
      `https://www.figma.com/design/${FIGMA_FILE_KEY}/?node-id=15935-115`,
    )
  })
})

describe('samplePath', () => {
  it('fills route params with demo ids', () => {
    expect(samplePath('/locations/:locationId/processes/:locationProcessId')).toBe(
      '/locations/demo/processes/demo',
    )
  })

  it('leaves static paths unchanged', () => {
    expect(samplePath('/admin/catalog')).toBe('/admin/catalog')
  })
})

describe('screensByRoute', () => {
  it('groups several screens living on one route', () => {
    // 15а — окно над вкладкой «Процессы локации» на маршруте локации (D-38).
    expect(screensByRoute(ROUTE_PATHS.location).map((s) => s.code)).toEqual(['15', '15а'])
    const codes = screensByRoute(ROUTE_PATHS.locationProcesses).map((s) => s.code)
    // Пустая вкладка (locprocsempty) — состояние того же адреса.
    expect(codes).toEqual(['17', '17в', '—'])
  })
})
