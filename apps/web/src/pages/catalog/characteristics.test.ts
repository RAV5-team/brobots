import { describe, expect, it } from 'vitest'
import type { Robot } from '@/domain'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import { robotCharacteristics, summarize } from './characteristics'

const CTX = { operationClasses: OPERATION_CLASSES, processes: PROCESSES, facilityTypes: FACILITY_TYPES, catalogVersion: 'v4' }
const robot = (name: string) => ROBOTS.find((r) => r.name === name) as Robot

describe('robot characteristics (К-4, D-76, D-77)', () => {
  it('takes AMR 800 from its stored record and its id from the record, not RB-0224 of the mockup', () => {
    const map = robotCharacteristics(robot('AMR 800'), CTX)
    expect(map.id).toEqual({ value: 'RB-0008', status: 'confirmed', source: 'каталог v4' })
    expect(map.connectivity).toEqual({ value: 'Wi-Fi 5 ГГц или private LTE на маршруте', status: 'estimate', source: 'типовое требование класса' })
    expect(map.dimensions).toMatchObject({ status: 'confirmed', source: 'морос.рф', date: '2026-09-19' })
  })

  it('summarizes AMR 800 exactly as К-4: 7 of 8 key specs, 27 of 30 fields, 17 · 10 · 3', () => {
    expect(summarize(robotCharacteristics(robot('AMR 800'), CTX))).toEqual({
      keyConfirmed: 7, keyTotal: 8, filled: 27, total: 30, counts: { confirmed: 17, estimate: 10, missing: 3 },
    })
  })

  it('derives AK-2000-2 from organizer fields: specs by analogy are estimates, the rest is missing', () => {
    const map = robotCharacteristics(robot('AK-2000-2'), CTX)
    expect(map.manufacturer).toEqual({ value: 'ООО «ГК Автомакон»', status: 'confirmed', source: 'каталог v4' })
    expect(map.payload).toMatchObject({ value: '1\u00a0500 кг', status: 'estimate' })
    expect(map.availability).toEqual({ value: 'в эксплуатации', status: 'confirmed', source: 'каталог v4 · УГТ 9' })
    expect(map.equipmentPrice).toMatchObject({ value: '2,94 млн ₽ · с НДС', status: 'confirmed' })
    expect(map.cases).toMatchObject({ status: 'confirmed' })
    for (const key of ['navigation', 'aisleRequirements', 'connectivity', 'software', 'limitations', 'sourceLink'] as const) {
      expect(map[key], key).toEqual({ value: null, status: 'missing', source: 'нет в данных организатора' })
    }
    const summary = summarize(map)
    expect(summary.counts.missing).toBeGreaterThan(summary.counts.confirmed)
    expect(summary.keyConfirmed).toBe(0)
  })

  it('marks a class bound by the admin demo as an estimate and a robot without data as missing (D-61)', () => {
    expect(robotCharacteristics(robot('AS-RS P'), CTX).operationClasses).toMatchObject({ status: 'estimate', value: 'OP-04 Хранение и выдача' })
    expect(robotCharacteristics(robot('Дельта-робот'), CTX).payload).toMatchObject({ status: 'missing' })
  })
})
