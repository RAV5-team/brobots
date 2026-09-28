import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OUTPUT, renderFixtures } from './genSimulationFixtures'

describe('синтетические прогоны симуляции', () => {
  it(`${OUTPUT} совпадает с выводом генератора (иначе — npm run gen:fixtures)`, async () => {
    expect(await readFile(resolve(process.cwd(), OUTPUT), 'utf8')).toBe(renderFixtures())
  })

  it('генератор детерминирован: два запуска дают один текст', () => {
    expect(renderFixtures()).toBe(renderFixtures())
  })
})
