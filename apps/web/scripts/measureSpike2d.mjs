// Замер спайка 2D-плеера (D-87): `node scripts/measureSpike2d.mjs <адрес>` — адрес собранного приложения (vite preview).
// Chromium 1366×768, кнопка «Замер»: 10 с на ×1800, два плеера. Прогоны без замедления и с замедлением CPU (CDP).
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5198'
// Замедления CPU через запятую: SPIKE_CPU=1,4,6 (по умолчанию).
const THROTTLING = (process.env.SPIKE_CPU ?? '1,4,6').split(',').map(Number)
const MIN_FPS = 30

const browser = await chromium.launch()
const results = []
for (const rate of THROTTLING) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await page.goto(`${BASE}/dev/spike-2d`)
  await page.getByRole('img', { name: /Из подбора/ }).waitFor()
  await page.getByRole('button', { name: /^Замер/ }).click()
  await page.waitForFunction(() => window.__spike2d !== undefined, undefined, { timeout: 60_000 })
  const stats = await page.evaluate(() => window.__spike2d)
  results.push({ cpu: `${String(rate)}×`, ...stats, passed: stats.fps >= MIN_FPS, errors: errors.length })
  await page.close()
}
await browser.close()
console.table(results.map((r) => ({ ...r, fps: Number(r.fps.toFixed(1)), p95FrameMs: Number(r.p95FrameMs.toFixed(1)) })))
