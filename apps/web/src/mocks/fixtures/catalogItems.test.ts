import { describe, expect, it } from 'vitest'
import {
  COMPLETENESS_GROUPS,
  completeness,
  countByStatus,
  deriveLaunchRequired,
  KEY_SPEC_KEYS,
  launchCostRub,
  ROBOT_CHARACTERISTIC_GROUPS,
  type Characteristic,
  type RobotId,
} from '@/domain'
import { LAUNCH_ITEMS } from './launchItems'
import { ROBOTS } from './robots'

/** Файлы фото в apps/web/public/catalog: ключи вида `../../../public/catalog/rb-0007.webp`. */
const PUBLIC_PHOTOS = Object.keys(import.meta.glob('../../../public/catalog/*.webp')).map((key) => key.replace('../../../public', ''))

/** «Для запуска» на К-1 задана явно (D-63): у остальных роботов значение считается по правилу. */
const K1_LAUNCH_OVERRIDES: readonly RobotId[] = ['RB-0007', 'RB-0008', 'RB-0014']

const AMR_800 = ROBOTS.find((r) => r.id === 'RB-0008')

const K1_ROBOTS = [
  'AMR 100', 'AMR 800', 'Курьер-30', 'AK-2000-2', 'РУБИ-С-03', 'АК-SC80', 'AS-RS P',
  'Инвентаризатор AI Stock Counter 12M', 'Яндекс-ровер R 4.0', 'Promobot V.4', 'Дельта-робот',
]

describe('catalog fixtures (К-1)', () => {
  it('has unique ids across robots and launch items', () => {
    const ids = [...ROBOTS.map((r) => r.id), ...LAUNCH_ITEMS.map((i) => i.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('holds every robot of К-1 once, Курьер-30 with both industries of the organizer file (D-56, D-61)', () => {
    for (const name of K1_ROBOTS) expect(ROBOTS.filter((r) => r.name === name), name).toHaveLength(1)
    expect(ROBOTS.find((r) => r.name === 'Курьер-30')?.industries).toEqual(['Безопасность', 'Транспорт и логистика'])
  })

  it('has 29 launch items: 13 INF, 6 SW, 5 SRV, 5 SUP (PRD 7.5)', () => {
    const count = (type: string) => LAUNCH_ITEMS.filter((i) => i.type === type).length
    expect([count('infrastructure'), count('software'), count('service'), count('support')]).toEqual([13, 6, 5, 5])
  })

  it('links compatibility only to ids that exist in the fixtures (D-65)', () => {
    const robotIds = new Set(ROBOTS.map((r) => r.id))
    const itemIds = new Set(LAUNCH_ITEMS.map((i) => i.id))
    for (const item of LAUNCH_ITEMS) {
      for (const ref of item.compatibleWith) {
        if (ref.kind === 'robot') expect(robotIds.has(ref.id), `${item.id} → ${ref.id}`).toBe(true)
        if (ref.kind === 'launch-item') expect(itemIds.has(ref.id), `${item.id} → ${ref.id}`).toBe(true)
      }
    }
  })

  it('derives «Для запуска» by the rule for every robot except the three set on К-1 (D-63)', () => {
    for (const robot of ROBOTS.filter((r) => !K1_LAUNCH_OVERRIDES.includes(r.id))) {
      expect(robot.launchRequired, robot.id).toEqual(deriveLaunchRequired(robot.id, LAUNCH_ITEMS))
    }
  })

  it('points every robot photo to a file in public/catalog (D-62)', () => {
    for (const robot of ROBOTS.filter((r) => r.photo)) {
      expect(PUBLIC_PHOTOS, robot.id).toContain(robot.photo?.path)
    }
  })

  it('links every launch position of a robot to an existing launch item (D-78)', () => {
    const itemIds = new Set(LAUNCH_ITEMS.map((i) => i.id))
    for (const robot of ROBOTS) {
      for (const id of [...robot.launchRequired, ...robot.launchConditional]) expect(itemIds.has(id), `${robot.id} → ${id}`).toBe(true)
    }
  })

  it('gives AMR 800 the launch part of К-4: 4 required from 3,9 million and 4 conditional (D-78)', () => {
    expect(AMR_800?.launchRequired).toEqual(['SI-INF-04', 'SI-SW-01', 'SI-SRV-02', 'SI-SW-02'])
    expect(AMR_800?.launchConditional).toEqual(['SI-INF-07', 'SI-INF-09', 'SI-INF-05', 'SI-INF-06'])
    expect(launchCostRub(AMR_800?.launchRequired ?? [], LAUNCH_ITEMS)).toBe(3_930_000)
  })

  it('counts AMR 800 as on К-4 by the D-77 rule: 27 of 30, 17 · 10 · 3, 7 of 8 key specs', () => {
    const values = AMR_800?.characteristics?.values ?? {}
    // Идентификатор не хранится — он из записи и подтверждён (D-76).
    const row = (key: string): Characteristic =>
      key === 'id' ? { value: 'RB-0008', status: 'confirmed', source: 'каталог v4' } : values[key as keyof typeof values] ?? { value: null, status: 'missing', source: '' }
    const rows = COMPLETENESS_GROUPS.flatMap((g) => ROBOT_CHARACTERISTIC_GROUPS[g]).map(row)
    expect(completeness(rows)).toEqual({ filled: 27, total: 30 })
    expect(countByStatus(rows)).toEqual({ confirmed: 17, estimate: 10, missing: 3 })
    expect(KEY_SPEC_KEYS.map(row).filter((c) => c.status === 'confirmed')).toHaveLength(7)
  })
})
