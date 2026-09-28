// Синтетические прогоны симуляции для моков: `npm run gen:fixtures` пишет src/mocks/fixtures/simulationRuns.generated.ts.
// НЕ из PRD: в PRD 11.4 есть только итоги (130 из 130 в пик, в срок 98,4 % в худший день, загрузка в пик 83 %),
// почасовых чисел нет. Скрипт детерминирован (фиксированный seed) и подгоняет ряды под эти итоги;
// сходимость проверяет src/mocks/fixtures/fixtures.test.ts. Формат — SimulationRun из services/simulation/docs/openapi.json.
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SimulationSchemas } from '../src/api/contract'

type Run = SimulationSchemas['SimulationRun']
type HourlyRow = SimulationSchemas['HourlyRow']

export const SEED = 20260926
export const OUTPUT = 'src/mocks/fixtures/simulationRuns.generated.ts'

/** Сквозной пример PRD 11: 2 000 операций в сутки, к роботизации 95 %, пик 130 рейсов/ч. */
export const DAILY_TRIPS = 1900
export const PEAK_TRIPS = 130
const SHIFT_START = 7
const WORK_HOURS = 22
/** Пики приёмки (08–11) и отгрузки (16–18) — как на макете 05 «Условия симуляции». */
const PEAK_HOURS = [8, 9, 10, 11, 16, 17, 18]

/** mulberry32: одинаковый seed — одинаковые ряды на любой машине. */
function random(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (value: number, digits = 3): number => Math.round(value * 10 ** digits) / 10 ** digits
const isWorking = (hour: number): boolean => (hour - SHIFT_START + 24) % 24 < WORK_HOURS

/** Потребность по часам: пики по 130, остальные рабочие часы делят остаток суток. */
function demandProfile(rnd: () => number): number[] {
  const offPeak = Array.from({ length: 24 }, (_, h) => (isWorking(h) && !PEAK_HOURS.includes(h) ? 0.6 + 0.8 * rnd() : 0))
  const rest = DAILY_TRIPS - PEAK_HOURS.length * PEAK_TRIPS
  const total = offPeak.reduce((sum, w) => sum + w, 0)
  const demand = offPeak.map((w, h) => (PEAK_HOURS.includes(h) ? PEAK_TRIPS : Math.floor((w / total) * rest)))
  // Остаток от округления — в самый нагруженный непиковый час.
  const gap = DAILY_TRIPS - demand.reduce((sum, d) => sum + d, 0)
  const busiest = offPeak.indexOf(Math.max(...offPeak))
  return demand.map((d, h) => (h === busiest ? d + gap : d))
}

interface Fleet {
  readonly robots: number
  readonly chargers: number
}

/** Как состав справляется: пиковая пропускная способность, рейсов/ч, доля паллет в срок за день, очередь к станциям. */
interface Behaviour {
  readonly fleet: Fleet
  readonly capacityPerHour: number
  readonly onTimeDay: number
  readonly chargerQueueAtPeak: number
  readonly blockedShare: number
}

function hourlyRows(demand: readonly number[], b: Behaviour, rnd: () => number): HourlyRow[] {
  let carry = 0
  const draft = demand.map((d, clock) => {
    const done = Math.min(d + carry, Math.floor(b.capacityPerHour))
    carry = d + carry - done
    return { clock, d, done, util: d === 0 ? 0 : Math.min(0.99, done / b.capacityPerHour), carry, noise: rnd() }
  })
  // Доля в срок: хуже в загруженные часы; затем масштаб отклонений так, чтобы за день вышло ровно onTimeDay.
  const miss = draft.map((r) => (r.d === 0 ? 0 : 0.2 * r.util ** 4 + 0.01 * r.noise + (r.carry > 0 ? 0.1 : 0)))
  const weighted = draft.reduce((sum, r, i) => sum + r.d * (miss[i] ?? 0), 0) / DAILY_TRIPS
  const scale = weighted === 0 ? 0 : (1 - b.onTimeDay) / weighted
  return draft.map((r, i) => {
    const n = b.fleet.robots
    const working = round(r.util * n, 2)
    const waitCharger = round(Math.min(PEAK_HOURS.includes(r.clock) ? b.chargerQueueAtPeak : 0, n - working), 2)
    const down = round(Math.max(0, Math.min(0.1 + 0.2 * r.noise, n - working - waitCharger)), 2)
    // Зарядка — из того, что осталось после работы, очереди и ремонта: сумма состояний равна парку.
    const wanted = r.d === 0 ? 0.15 * n : 0.07 * n + 0.4 * r.noise
    const charging = round(Math.max(0, Math.min(wanted, n - working - waitCharger - down)), 2)
    return {
      clock: r.clock,
      demand: r.d,
      done: r.done,
      on_time: r.d === 0 ? null : round(Math.max(0, 1 - (miss[i] ?? 0) * scale)),
      wait_mean_min: r.d === 0 ? null : round(1.5 + 6 * r.util ** 3 + (r.carry > 0 ? 4 : 0), 1),
      work: working,
      charge: charging,
      wait_charger: waitCharger,
      down,
      idle: round(Math.max(0, n - working - charging - waitCharger - down), 2),
      util: round(r.util),
      backlog_max: r.carry + Math.round(r.d * 0.05),
      chargers_busy: round(Math.min(1, charging / b.fleet.chargers)),
    }
  })
}

const weightedOnTime = (rows: readonly HourlyRow[]): number =>
  round(rows.reduce((sum, r) => sum + r.demand * (r.on_time ?? 1), 0) / rows.reduce((sum, r) => sum + r.demand, 0))
const peakRows = (rows: readonly HourlyRow[]) => rows.filter((r) => PEAK_HOURS.includes(r.clock))
const mean = (values: readonly number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length

function checks(rows: readonly HourlyRow[], b: Behaviour): SimulationSchemas['Checks'] {
  const served = Math.min(...peakRows(rows).map((r) => r.done))
  const onTime = weightedOnTime(rows)
  const throughput = { required_h: PEAK_TRIPS, served_h: served, ratio: round(served / PEAK_TRIPS), peak_hours: PEAK_HOURS.length }
  const completion = round(rows.reduce((s, r) => s + r.done, 0) / DAILY_TRIPS)
  const list: SimulationSchemas['Check'][] = [
    { code: 'throughput', name: 'Пиковый поток', value: served, target: round(PEAK_TRIPS * 0.9, 1), ok: served >= PEAK_TRIPS * 0.9, unit: 'рейсов/ч' },
    { code: 'wait', name: 'Паллеты в срок', value: onTime, target: 0.95, ok: onTime >= 0.95, unit: 'доля' },
    { code: 'completion', name: 'Рейсы за сутки', value: completion, target: 1, ok: completion >= 0.999, unit: 'доля' },
    { code: 'battery', name: 'Зарядка успевает', value: 0, target: 0, ok: b.chargerQueueAtPeak < 1, unit: 'роботов разряжено' },
  ]
  return { ok: list.every((c) => c.ok), checks: list, throughput, layout_flag: b.blockedShare > 0.1, blocked_share: b.blockedShare }
}

/** Доли состояний внутри «работы», «зарядки», «ремонта» и «ожидания» — синтетические, как у движка (engine.STATES). */
const WORK_SPLIT = { to_pickup: 0.34, loading: 0.12, to_drop: 0.4, unloading: 0.14 } as const
const BLOCKED_SPLIT = { blocked: 0.8, queue: 0.2 } as const
const CHARGE_SPLIT = { to_charger: 0.15, charging: 0.85 } as const
const DOWN_SPLIT = { down: 0.9, towed: 0.1 } as const

/**
 * Время парка по состояниям движка (kpis.fleet_shares, simcore.metrics._fleet_kpis): робото-часы почасовых рядов,
 * работа делится на рейс и погрузку, из неё же — ожидание проезда (blocked_share). Сумма долей — 1.
 */
function fleetShares(rows: readonly HourlyRow[], b: Behaviour): Record<string, number> {
  const sum = (pick: (r: HourlyRow) => number) => rows.reduce((total, r) => total + pick(r), 0)
  const work = sum((r) => r.work)
  const charge = sum((r) => r.charge)
  const down = sum((r) => r.down)
  const total = work + charge + sum((r) => r.wait_charger) + down + sum((r) => r.idle)
  const blocked = Math.min(work, b.blockedShare * total)
  const part = (split: Readonly<Record<string, number>>, hours: number) =>
    Object.fromEntries(Object.entries(split).map(([state, k]) => [state, round((k * hours) / total, 4)]))
  return {
    idle: round(sum((r) => r.idle) / total, 4),
    ...part(WORK_SPLIT, work - blocked),
    ...part(BLOCKED_SPLIT, blocked),
    ...part(CHARGE_SPLIT, charge),
    wait_charger: round(sum((r) => r.wait_charger) / total, 4),
    ...part(DOWN_SPLIT, down),
  }
}

function kpis(rows: readonly HourlyRow[], b: Behaviour, onTimeWorst: number): SimulationSchemas['Kpis'] {
  const chk = checks(rows, b)
  const peak = peakRows(rows)
  return {
    on_time: weightedOnTime(rows),
    on_time_min: onTimeWorst,
    util_peak: round(mean(peak.map((r) => r.util))),
    util_day: round(mean(rows.filter((r) => r.demand > 0).map((r) => r.util))),
    charge_peak: round(mean(peak.map((r) => r.charge + r.wait_charger)), 2),
    queue_peak: b.chargerQueueAtPeak,
    depleted: 0,
    throughput: chk.throughput,
    fleet_shares: fleetShares(rows, b),
    completion: chk.checks[2]?.value ?? 1,
    blocked_share: b.blockedShare,
    breakdowns: 1,
    charger_util: round(mean(rows.map((r) => r.chargers_busy))),
  }
}

interface Scenario {
  readonly id: string
  readonly status: Run['status']
  readonly before: Behaviour
  readonly after: Behaviour
  readonly onTimeWorstBefore: number
  readonly onTimeWorstAfter: number
  readonly title: string
  readonly lines: readonly string[]
  readonly justification: readonly string[]
  readonly diagnosis: readonly string[]
}

const F18: Fleet = { robots: 18, chargers: 6 }
const confirmedBehaviour: Behaviour = { fleet: F18, capacityPerHour: 156.6, onTimeDay: 0.984, chargerQueueAtPeak: 0, blockedShare: 0.02 }
const RISKS = ['ТТХ AMR 800 приняты по аналогу — подтвердить у производителя', 'Остановки из-за людей в проходах — замерить на пилоте']

/** Пять вердиктов PRD 11.4. Основной — confirmed (SIM-0926-01, PRD 11.5); can_reduce — близкий к макету 07 (18 → 16). */
const SCENARIOS: readonly Scenario[] = [
  {
    id: 'SIM-0926-01', status: 'confirmed', before: confirmedBehaviour, after: confirmedBehaviour,
    onTimeWorstBefore: 0.984, onTimeWorstAfter: 0.984,
    title: 'Конфигурация подтверждена: 18 роботов и 6 станций справляются, меньше нельзя',
    lines: ['Пиковый час: 130 рейсов при потребности 130', 'Все паллеты забраны в срок: 98,4 % в худший день', 'Зарядка успевает: очереди к станциям нет'],
    justification: ['16 роботов не выдерживают рост объёма на 10 %'],
    diagnosis: ['Самый тяжёлый час — 17:00: совпадают отгрузка и подзарядка'],
  },
  {
    id: 'SIM-0926-02', status: 'can_reduce', before: confirmedBehaviour,
    after: { fleet: { robots: 16, chargers: 5 }, capacityPerHour: 139, onTimeDay: 0.975, chargerQueueAtPeak: 0.3, blockedShare: 0.03 },
    onTimeWorstBefore: 0.984, onTimeWorstAfter: 0.975,
    title: 'Можно уменьшить до 16 роботов и 5 станций',
    lines: ['Пиковый час: 130 рейсов при потребности 130', 'Все паллеты забраны в срок в каждом дне', 'Минус 3 робота — поток не вывозится'],
    justification: ['16 роботов выдерживают рост объёма на 10 %', 'Экономия 2 роботов и 1 станции'],
    diagnosis: ['Самый тяжёлый час — 17:00: совпадают отгрузка и подзарядка'],
  },
  {
    id: 'SIM-0926-03', status: 'needs_additions',
    before: { fleet: { robots: 15, chargers: 6 }, capacityPerHour: 122.2, onTimeDay: 0.824, chargerQueueAtPeak: 0, blockedShare: 0.02 },
    after: confirmedBehaviour, onTimeWorstBefore: 0.775, onTimeWorstAfter: 0.984,
    title: 'Чтобы работало, докупить +3 робота',
    lines: ['В пик 122 рейса из 130 — 94,0 % потребности', 'В срок 82,4 % паллет, в худший день 77,5 %', 'С 18 роботами поток вывозится'],
    justification: [],
    diagnosis: ['Не хватает роботов в часы приёмки 08–11'],
  },
  {
    id: 'SIM-0926-04', status: 'layout_bottleneck',
    before: { fleet: F18, capacityPerHour: 112, onTimeDay: 0.86, chargerQueueAtPeak: 0, blockedShare: 0.18 },
    after: { fleet: F18, capacityPerHour: 112, onTimeDay: 0.86, chargerQueueAtPeak: 0, blockedShare: 0.18 },
    onTimeWorstBefore: 0.83, onTimeWorstAfter: 0.83,
    title: 'Узкое место в планировке: докупка роботов не помогает',
    lines: ['В пик 112 рейсов из 130', 'Роботы стоят в проездах у ворот 18 % времени'],
    justification: [],
    diagnosis: ['Проезд у ворот приёмки 1–6 — одна полоса на 18 роботов'],
  },
  {
    id: 'SIM-0926-05', status: 'not_achievable',
    before: { fleet: F18, capacityPerHour: 95, onTimeDay: 0.7, chargerQueueAtPeak: 1.2, blockedShare: 0.05 },
    after: { fleet: F18, capacityPerHour: 95, onTimeDay: 0.7, chargerQueueAtPeak: 1.2, blockedShare: 0.05 },
    onTimeWorstBefore: 0.64, onTimeWorstAfter: 0.64,
    title: 'Поток недостижим: нужно больше 60 роботов',
    lines: ['В пик 95 рейсов из 130', 'Цикл рейса дольше расчётного вдвое'],
    justification: [],
    diagnosis: ['Проверьте длину маршрута и скорость робота с паллетой'],
  },
]

function buildRun(s: Scenario, demand: readonly number[], seed: number): Run {
  const before = hourlyRows(demand, s.before, random(seed))
  const after = s.after === s.before ? before : hourlyRows(demand, s.after, random(seed + 1))
  const kBefore = kpis(before, s.before, s.onTimeWorstBefore)
  const changed = s.before.fleet.robots !== s.after.fleet.robots || s.before.fleet.chargers !== s.after.fleet.chargers
  return {
    simulation_id: s.id,
    configuration_id: 'AMR-800-RAAS',
    simulation_version: 'sim-0.14.0',
    scenario: { name: 'РЦ Химки · перемещение паллет' },
    resolved_params: {},
    status: s.status,
    label: changed ? 'обновлено по 2D-модели' : null,
    tolerance: 0.1,
    fleet_policy: 'add_and_reduce',
    design_volume: 'current',
    verdict: { title: s.title, lines: [...s.lines], justification: [...s.justification], risks: [...RISKS] },
    checks_before: checks(before, s.before),
    checks_after: checks(after, s.after),
    fleet_change: {
      robots: s.after.fleet.robots - s.before.fleet.robots,
      chargers: s.after.fleet.chargers - s.before.fleet.chargers,
      from_: s.before.fleet,
      to: s.after.fleet,
    },
    diagnosis: [...s.diagnosis],
    reduction: s.status === 'can_reduce' ? { target_volume: 1.1, checked: true, possible: true, original_passes_growth: true } : null,
    growth_check: null,
    evidence: { volume_k: 1, curve: [], stations: [] },
    kpis: kpis(after, s.after, s.onTimeWorstAfter),
    kpis_before: {
      on_time: kBefore.on_time, on_time_min: kBefore.on_time_min, util_peak: kBefore.util_peak, util_day: kBefore.util_day,
      charge_peak: kBefore.charge_peak, queue_peak: kBefore.queue_peak, depleted: kBefore.depleted,
      throughput: kBefore.throughput, fleet_shares: kBefore.fleet_shares,
    },
    hourly_before: before,
    hourly_after: after,
    demand: {
      hours: Array.from({ length: 24 }, (_, h) => h),
      rate_in: demand.map((d) => Math.round(d / 2)),
      rate_out: demand.map((d) => d - Math.round(d / 2)),
      peak_in: Array.from({ length: 24 }, (_, h) => h >= 8 && h <= 11),
      peak_out: Array.from({ length: 24 }, (_, h) => h >= 16 && h <= 18),
      calc_peak_trips_h: PEAK_TRIPS,
    },
    adjusted_input_set: { items: [] },
    warnings: [],
    timing: { total_s: 12, runs: 5, per_run_s: 2.4, configs: changed ? 2 : 1 },
  }
}

export function generateRuns(): Run[] {
  const demand = demandProfile(random(SEED))
  return SCENARIOS.map((s, i) => buildRun(s, demand, SEED + 10 * (i + 1)))
}

/** Строки почасовых рядов — по одной на строку файла, остальное — как JSON с отступами. */
function format(value: unknown, indent = ''): string {
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'object' && v !== null && !Array.isArray(v))) {
    const inner = `${indent}  `
    const flat = value.every((v) => Object.values(v as object).every((x) => x === null || typeof x !== 'object'))
    return `[\n${value.map((v) => inner + (flat ? JSON.stringify(v) : format(v, inner))).join(',\n')},\n${indent}]`
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const inner = `${indent}  `
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`).join(',\n')},\n${indent}}`
  }
  return JSON.stringify(value)
}

export function renderFixtures(): string {
  return `// СИНТЕТИЧЕСКИЕ данные, не из PRD — генерирует scripts/genSimulationFixtures.ts (seed ${String(SEED)}). Не править вручную: npm run gen:fixtures.
// Итоги сходятся с PRD 11.4–11.5 (проверяет fixtures.test.ts); формат — SimulationRun из services/simulation/docs/openapi.json.
import type { SimulationSchemas } from '@/api/contract'

export const SIMULATION_RUNS: readonly SimulationSchemas['SimulationRun'][] = ${format(generateRuns())}
`
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await writeFile(resolve(process.cwd(), OUTPUT), renderFixtures())
  console.warn(`→ ${OUTPUT}`)
}
