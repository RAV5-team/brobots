import { describe, expect, it } from 'vitest'
import type { Robot } from '@/domain'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { adminCatalogAddedPath, buildCatalogRows, filterCatalogRows, formatUpdated, shownLabel } from './catalogModel'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')
const NOW = Date.parse('2026-09-27T12:00:00+03:00')
const rows = buildCatalogRows(ROBOTS, NOW)
const row = (name: string) => {
  const found = rows.find((r) => r.name === name)
  if (!found) throw new Error(`нет строки ${name}`)
  return found
}

describe('buildCatalogRows (экран А1)', () => {
  it('puts solutions awaiting confirmation first, then orders by RB id as in the mockup', () => {
    expect(rows.slice(0, 12).map((r) => r.name)).toEqual([
      'DMR 600', 'Сёмабот', 'Ronavi H1500', 'Ronavi SR', 'Ronavi H2000', 'Ronavi SD',
      'Ronavi M', 'Ronavi RCM', 'AMR 100', 'AMR 800', 'AMR 1500', 'DMR 1200',
    ])
    expect(rows).toHaveLength(ROBOTS.length)
  })

  it('marks only DMR 600 and Сёмабот as «требует подтверждения» (D-36, PRD 15 · №53)', () => {
    expect(rows.filter((r) => r.needsConfirmation).map((r) => r.name)).toEqual(['DMR 600', 'Сёмабот'])
    expect(row('Ronavi RCM').needsConfirmation).toBe(false)
  })

  it('formats the columns as the catalog shows them (PRD 6.2)', () => {
    const dmr = row('DMR 600')
    expect(plain(dmr.meta)).toBe('ООО «Диком-Сервис» · Мобильные роботы')
    expect(dmr.operationClasses).toEqual(['OP-01'])
    expect(plain(dmr.payload ?? '')).toBe('до 600 кг')
    expect(plain(dmr.price ?? '')).toBe('3,75 млн ₽')
    expect(dmr.updated).toBe('12.08.2026')
    expect(plain(row('Сёмабот').payload ?? '')).toBe('до 1 500 кг')
    expect(row('AMR 800').updated).toBe('19.09.2026')
  })

  it('counts ТТХ completeness from the eight technical parameters (D-36, PRD 15 · №16)', () => {
    expect(plain(row('AMR 800').completeness)).toBe('100 %')
    expect(plain(row('AMR 1500').completeness)).toBe('63 %')
    expect(plain(row('DMR 600').completeness)).toBe('13 %')
  })

  it('shows «нет цены» data as null and keeps robots without payload', () => {
    const pudu = row('PuduBot 2')
    expect(pudu.price).toBeNull()
    expect(row('Робот-тягач RoboCV').payload).toBeNull()
  })
})

describe('formatUpdated', () => {
  it('says «сейчас» for a change within the last minute (экран А3)', () => {
    expect(formatUpdated('2026-09-27T11:59:30+03:00', NOW)).toBe('сейчас')
    expect(formatUpdated('2026-09-27T11:58:00+03:00', NOW)).toBe('27.09.2026')
  })
})

describe('filterCatalogRows', () => {
  it('searches by name and manufacturer, ignoring case and «ё»', () => {
    expect(filterCatalogRows(rows, 'ronavi h').map((r) => r.name)).toEqual(['Ronavi H1500', 'Ronavi H2000'])
    expect(filterCatalogRows(rows, 'МОРОС')).toHaveLength(3)
    expect(filterCatalogRows(rows, 'семабот').map((r) => r.name)).toEqual(['Сёмабот'])
  })

  it('returns every row for an empty query', () => {
    expect(filterCatalogRows(rows, '  ')).toBe(rows)
  })

  it('does not search by type or class', () => {
    expect(filterCatalogRows(rows, 'Мобильные')).toHaveLength(0)
  })
})

describe('shownLabel', () => {
  it('declines the total after «из»', () => {
    expect(plain(shownLabel(12, 20))).toBe('Показаны 12 из 20 решений')
    expect(plain(shownLabel(1, 21))).toBe('Показано 1 из 21 решения')
  })
})

describe('robots without operation classes', () => {
  it('keep an empty class list', () => {
    const base = ROBOTS[0] as Robot
    const [only] = buildCatalogRows([{ ...base, operationClasses: [] }], NOW)
    expect(only?.operationClasses).toEqual([])
  })
})

describe('buildCatalogRows · робот добавлен (экран А3)', () => {
  const JUST_SAVED = Date.parse('2026-09-19T12:00:20+03:00')
  const added = buildCatalogRows(ROBOTS, JUST_SAVED, 'RB-0008')

  it('lifts the saved solution right after the confirmation queue, as in the mockup (15966:6325)', () => {
    expect(added.slice(0, 4).map((r) => r.name)).toEqual(['DMR 600', 'Сёмабот', 'AMR 800', 'Ronavi H1500'])
    expect(added).toHaveLength(ROBOTS.length)
  })

  it('shows «сейчас» for a solution saved less than a minute ago (PRD 6.2)', () => {
    expect(added.find((r) => r.name === 'AMR 800')?.updated).toBe('сейчас')
  })

  it('keeps the А1 order for an unknown id', () => {
    expect(buildCatalogRows(ROBOTS, NOW, 'RB-9999').map((r) => r.id)).toEqual(rows.map((r) => r.id))
  })
})

describe('adminCatalogAddedPath', () => {
  it('points to the catalog with the saved robot in the address (D-22)', () => {
    expect(adminCatalogAddedPath('RB-0008')).toBe('/admin/catalog?added=RB-0008')
  })
})
