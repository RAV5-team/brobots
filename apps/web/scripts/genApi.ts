// Типы ответов API из контрактов: `npm run gen:api` пишет src/api/generated/*.d.ts.
// Контракты только читаем: api.yaml генерирует services/api (go generate), openapi.json — services/simulation.
import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'

// Корень — apps/web: оттуда запускают `npm run gen:api` и Vitest.
const WEB_ROOT = process.cwd()
const WEB_PACKAGE = resolve(WEB_ROOT, 'package.json')
if (!existsSync(WEB_PACKAGE) || !readFileSync(WEB_PACKAGE, 'utf8').includes('"name": "@rav5/web"')) {
  throw new Error(`genApi запускается из apps/web (npm run gen:api), а не из ${WEB_ROOT}`)
}

/** Контракт → сгенерированный файл (пути от apps/web). */
export const API_SOURCES = [
  { contract: '../../packages/contracts/openapi/api.yaml', output: 'src/api/generated/api.d.ts' },
  { contract: '../../services/simulation/docs/openapi.json', output: 'src/api/generated/simulation.d.ts' },
] as const

export const resolveFromWeb = (path: string): string => resolve(WEB_ROOT, path)

/** Текст .d.ts для контракта — тот же, что пишет CLI openapi-typescript. */
export async function generateTypes(contract: string): Promise<string> {
  const ast = await openapiTS(pathToFileURL(resolveFromWeb(contract)))
  return COMMENT_HEADER + astToString(ast)
}

/** Сгенерированный файл совпадает с контрактом. */
export async function isUpToDate(source: (typeof API_SOURCES)[number]): Promise<boolean> {
  const [expected, actual] = await Promise.all([generateTypes(source.contract), readFile(resolveFromWeb(source.output), 'utf8')])
  return expected === actual
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const { contract, output } of API_SOURCES) {
    await writeFile(resolveFromWeb(output), await generateTypes(contract))
    console.warn(`${contract} → ${output}`)
  }
}
