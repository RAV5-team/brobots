// Почасовые срезы 2D-трасс для кадра отчёта 09: `npm run gen:traces` пишет src/mocks/fixtures/traces/<файл>.hourly.json.
// Тот же формат export_trace, но кадры только на границах часа (step_s = 3600): отчёту нужен один кадр на паузе
// в первом пиковом часе (D-107), а полная трасса — 1,6–1,8 МБ. Час делится на шаг записи нацело, поэтому кадры
// среза совпадают с кадрами полной трассы; это проверяет src/mocks/fixtures/traces.test.ts.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const TRACE_DIR = 'src/mocks/fixtures/traces'
export const TRACE_FILES = ['demo-18-6', 'demo-16-5'] as const
export const HOURLY_STEP_S = 3600

interface TraceJson {
  readonly step_s: number
  readonly frames: readonly { readonly t: number }[]
  readonly [key: string]: unknown
}

/** Кадры на границах часа; шаг записи должен делить час нацело — иначе срез не совпадёт с записью. */
export function hourlyTrace(trace: TraceJson): TraceJson {
  if (HOURLY_STEP_S % trace.step_s !== 0) {
    throw new Error(`Шаг записи ${String(trace.step_s)} с не делит час нацело — почасовой срез не совпадёт с трассой`)
  }
  return { ...trace, step_s: HOURLY_STEP_S, frames: trace.frames.filter((frame) => frame.t % HOURLY_STEP_S === 0) }
}

async function main(): Promise<void> {
  for (const name of TRACE_FILES) {
    const source = resolve(TRACE_DIR, `${name}.json`)
    const trace = JSON.parse(await readFile(source, 'utf8')) as TraceJson
    const output = resolve(TRACE_DIR, `${name}.hourly.json`)
    const hourly = hourlyTrace(trace)
    await writeFile(output, JSON.stringify(hourly))
    console.warn(`${output}: кадров ${String(hourly.frames.length)} из ${String(trace.frames.length)}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
