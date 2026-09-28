// Замер 2D-плееров экрана 07a (D-87, D-105): `node scripts/measurePlayer07a.mjs <адрес>` — адрес собранного приложения
// (vite preview). Chromium 1366×768, сценарий «можно уменьшить» (два плеера), ×1800, 10 с с начала записи.
// Частота — по отметкам requestAnimationFrame; ход часов — сколько записи прошло за замер (ожидается ×1800).
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:5198'
const THROTTLING = (process.env.PLAYER_CPU ?? '1,4,6').split(',').map(Number)
const MEASURE_MS = 10_000
const MIN_FPS = 30
const LONG_FRAME_MS = 1000 / 30 + 1

/** Время на часах плеера «ЧЧ:ММ» → минуты. */
const minutes = (label) => {
  const [h, m] = label.split(':').map(Number)
  return h * 60 + m
}

const browser = await chromium.launch()
const results = []
for (const rate of THROTTLING) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`${BASE}/dev/screens?as=user`)
  await page.getByRole('button', { name: /графики и 2D-сравнение/ }).click()
  await page.getByRole('img', { name: /^С уменьшением/ }).waitFor()
  await page.getByRole('radio', { name: '×1800' }).click()
  await page.getByRole('button', { name: 'Сначала' }).click()
  const clock = page.getByRole('timer', { name: 'Время дня' })
  const from = await clock.textContent()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await page.getByRole('button', { name: 'Пуск' }).click()
  const stats = await page.evaluate((ms) => new Promise((resolve) => {
    const stamps = []
    const tick = (now) => {
      stamps.push(now)
      if (now - stamps[0] < ms) requestAnimationFrame(tick)
      else resolve(stamps)
    }
    requestAnimationFrame(tick)
  }), MEASURE_MS)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await page.getByRole('button', { name: 'Пауза' }).click()
  const to = await clock.textContent()
  const durations = stats.slice(1).map((t, i) => t - stats[i])
  const sorted = [...durations].sort((a, b) => a - b)
  const fps = durations.length / ((stats.at(-1) - stats[0]) / 1000)
  results.push({
    cpu: `${String(rate)}×`,
    fps: Number(fps.toFixed(1)),
    p95FrameMs: Number((sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0).toFixed(1)),
    longFrames: `${String(durations.filter((d) => d > LONG_FRAME_MS).length)} из ${String(durations.length)}`,
    clock: `${from} → ${to}`,
    recordMin: minutes(to) - minutes(from),
    passed: fps >= MIN_FPS,
    errors: errors.length,
  })
  await page.close()
}
await browser.close()
console.table(results)
