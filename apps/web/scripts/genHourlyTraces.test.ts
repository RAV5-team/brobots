import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOURLY_STEP_S, TRACE_DIR, TRACE_FILES, hourlyTrace } from './genHourlyTraces'

const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(process.cwd(), TRACE_DIR, file), 'utf8'))

describe('почасовые срезы 2D-трасс', { timeout: 30_000 }, () => {
  it.each(TRACE_FILES)('%s.hourly.json совпадает с выводом генератора (иначе — npm run gen:traces)', async (name) => {
    const full = (await read(`${name}.json`)) as Parameters<typeof hourlyTrace>[0]
    expect(await read(`${name}.hourly.json`)).toEqual(hourlyTrace(full))
  })

  it('кадры — только на границах часа, шаг — час', () => {
    const trace = { step_s: 15, frames: [0, 15, 3600, 3615, 7200].map((t) => ({ t })) }
    expect(hourlyTrace(trace)).toEqual({ step_s: HOURLY_STEP_S, frames: [{ t: 0 }, { t: 3600 }, { t: 7200 }] })
  })

  it('шаг записи, который не делит час, — ошибка: срез не совпал бы с записью', () => {
    expect(() => hourlyTrace({ step_s: 7, frames: [] })).toThrow(/не делит час/)
  })
})
