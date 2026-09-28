import { describe, expect, it } from 'vitest'
import type { LocationDocument } from '@/domain'
import { LOCATION_DOCUMENTS } from '@/mocks/fixtures/locationDocuments'
import { documentBadge, documentCaption, groupUploads } from './locationDocumentsModel'

const file = (name: string) => new File(['x'], name)
const byId = (id: string): LocationDocument => {
  const found = LOCATION_DOCUMENTS.find((d) => d.id === id)
  if (!found) throw new Error(id)
  return found
}

describe('documentCaption (PRD 10.3, экран 17б)', () => {
  it('matches the four rows of the mockup', () => {
    expect(LOCATION_DOCUMENTS.map(documentCaption)).toEqual([
      'CAD-план · загружено 12.09.2026',
      'фото · 10 файлов · загружено 10.09.2026',
      'Excel · загружено 14.09.2026',
      'схема · загружено 14.09.2026',
    ])
  })

  it('declines the file count of a photo group', () => {
    expect(documentCaption({ ...byId('DOC-02'), fileCount: 2 })).toBe('фото · 2 файла · загружено 10.09.2026')
  })

  it('shows the extension in capitals on the badge', () => {
    expect(documentBadge(byId('DOC-01'))).toBe('DWG')
  })
})

describe('groupUploads (D-42)', () => {
  it('keeps a single file as one document', () => {
    expect(groupUploads([file('План.dwg')]).map((g) => g.map((f) => f.name))).toEqual([['План.dwg']])
  })

  it('groups images picked together at the place of the first one, other files stay separate', () => {
    const groups = groupUploads([file('Обследование.xlsx'), file('1.jpg'), file('Схема.pdf'), file('2.PNG')])
    expect(groups.map((g) => g.map((f) => f.name))).toEqual([['Обследование.xlsx'], ['1.jpg', '2.PNG'], ['Схема.pdf']])
  })
})
