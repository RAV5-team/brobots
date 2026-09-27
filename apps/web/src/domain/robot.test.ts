import { describe, expect, it } from 'vitest'
import { isSameRobot, nextRobotId, specsCompleteness } from './robot'

describe('specsCompleteness (полнота ТТХ, D-46)', () => {
  it('is zero when no technical parameter is filled', () => {
    expect(specsCompleteness({ confidence: 'unconfirmed' })).toBe(0)
  })

  it('counts dimensions and load / unload as one parameter each, only when complete', () => {
    expect(specsCompleteness({ confidence: 'partial', lengthMm: 940, widthMm: 640 })).toBe(0)
    expect(specsCompleteness({ confidence: 'partial', lengthMm: 940, widthMm: 640, heightMm: 230 })).toBe(1 / 8)
    expect(specsCompleteness({ confidence: 'partial', loadTimeS: 45, unloadTimeS: 45 })).toBe(1 / 8)
  })

  it('gives 7 of 8 for a card without the average power (журнал «7 из 8»)', () => {
    const specs = {
      confidence: 'partial', payloadKg: 800, maxSpeedMps: 2, autonomyH: 24, chargeTimeMin: 60,
      lengthMm: 940, widthMm: 640, heightMm: 230, minTempC: 5, loadTimeS: 45, unloadTimeS: 45,
    } as const
    expect(specsCompleteness(specs)).toBe(7 / 8)
    expect(specsCompleteness({ ...specs, avgPowerKw: 1 })).toBe(1)
  })
})

describe('nextRobotId (идентификатор RB-NNNN, PRD 6.3)', () => {
  it('takes the maximum plus one, four digits', () => {
    expect(nextRobotId(['RB-0008', 'RB-0224', 'RB-0187'])).toBe('RB-0225')
    expect(nextRobotId([])).toBe('RB-0001')
  })

  it('never reuses a code and ignores malformed ids', () => {
    expect(nextRobotId(['RB-0003', 'RB-x', 'RB-0001'])).toBe('RB-0004')
  })
})

describe('isSameRobot (дубль в каталоге, PRD 6.1)', () => {
  it('ignores case, extra spaces and ё', () => {
    expect(isSameRobot({ name: ' amr  800', manufacturer: 'ООО «Морос»' }, { name: 'AMR 800', manufacturer: 'ооо «морос» ' })).toBe(true)
    expect(isSameRobot({ name: 'Ёж', manufacturer: 'А' }, { name: 'еж', manufacturer: 'а' })).toBe(true)
  })

  it('needs both name and manufacturer to match', () => {
    expect(isSameRobot({ name: 'AMR 800', manufacturer: 'Морос' }, { name: 'AMR 800', manufacturer: 'Ронави' })).toBe(false)
  })
})
