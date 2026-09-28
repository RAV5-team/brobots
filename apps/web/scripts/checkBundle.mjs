// Бюджет JS первой загрузки (правила web/performance.md: страница приложения < 300 КБ gzip).
// `npm run check:bundle`: после сборки суммирует gzip всех скриптов, которые подключает и предзагружает dist/index.html.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 300
const dist = resolve(process.cwd(), 'dist')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const scripts = [...new Set(html.match(/assets\/[^"]+\.js/g) ?? [])]
const sizes = scripts.map((file) => ({ file, kb: gzipSync(readFileSync(resolve(dist, file))).length / 1024 }))
const total = sizes.reduce((sum, s) => sum + s.kb, 0)
for (const { file, kb } of sizes) console.warn(`${kb.toFixed(1).padStart(7)} КБ  ${file}`)
console.warn(`${total.toFixed(1).padStart(7)} КБ  первая загрузка, бюджет ${String(BUDGET_KB)} КБ`)
if (total > BUDGET_KB) {
  console.error(`Бюджет JS первой загрузки превышен на ${(total - BUDGET_KB).toFixed(1)} КБ gzip`)
  process.exit(1)
}
