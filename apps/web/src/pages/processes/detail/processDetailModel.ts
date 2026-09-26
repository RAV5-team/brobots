import type {
  DataConfidence,
  FacilityParameter,
  FacilityType,
  FacilityTypeCode,
  Location,
  LocationId,
  LocationProcess,
  LocationProcessId,
  Process,
  Robot,
} from '@/domain'
import { ROUTE_PATHS } from '@/app/routePaths'
import { formatCount, formatNumber, formatPercent, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { rateUnit } from '../processesModel'
import { PAYROLL_COEF_PARAMETER, PEAK_FACTOR_PARAMETER, STAFF_PARAMETERS } from '../staffParameters'

const t = ru.processCard
const MONTHS_PER_YEAR = 12
/** Карточек решений в блоке — как на макете; остальные — в каталоге по кнопке «Открыть каталог по процессу». */
export const ROBOT_CARDS_LIMIT = 6
/** Порядок «по подтверждённости данных»: да → частично → нет (PRD 7). */
export const CONFIDENCE_ORDER: readonly DataConfidence[] = ['confirmed', 'partial', 'unconfirmed']

/** «Склад, аэропорт» → «Склад · Аэропорт»: названия типов объекта процесса. */
export function facilityNames(process: Process, facilityTypes: readonly FacilityType[]): readonly string[] {
  return process.facilityTypes.map((code) => facilityTypes.find((f) => f.code === code)?.name ?? code)
}

/** «паллета на полу» → «Паллета на полу». */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ru-RU') + text.slice(1)
}

export interface RouteSegment {
  readonly from: string
  readonly to: string
}

/** Типовые точки → участки маршрута «Приёмка → Зона хранения», «Зона хранения → Отгрузка». */
export function routeSegments(points: readonly string[] | undefined): readonly RouteSegment[] {
  if (!points) return []
  return points.slice(1).map((to, index) => ({ from: points[index] ?? '', to }))
}

export interface RobotSummary {
  readonly total: number
  readonly byConfidence: Readonly<Record<DataConfidence, number>>
  /** Первые карточки по подтверждённости данных; внутри группы — порядок каталога. */
  readonly featured: readonly Robot[]
}

/** Совпадение по классу — до жёстких проверок (PRD 3.4): счётчик и разбивка по качеству данных считаются. */
export function robotSummary(robots: readonly Robot[]): RobotSummary {
  const byConfidence = Object.fromEntries(
    CONFIDENCE_ORDER.map((c) => [c, robots.filter((r) => r.specs.confidence === c).length]),
  ) as Record<DataConfidence, number>
  const rank = (robot: Robot) => CONFIDENCE_ORDER.indexOf(robot.specs.confidence)
  const featured = [...robots].sort((a, b) => rank(a) - rank(b)).slice(0, ROBOT_CARDS_LIMIT)
  return { total: robots.length, byConfidence, featured }
}

/** «ООО «Ронави Роботикс»» → «Ронави Роботикс»: правовая форма на карточке не нужна (макет 15935:1481). */
export function shortManufacturer(name: string): string {
  return name.replace(/^(ООО|АО|ПАО|ЗАО|ОАО)\s+/u, '').replace(/^«(.*)»$/u, '$1')
}

export interface RobotCardView {
  readonly id: Robot['id']
  readonly name: string
  readonly vendor: string
  readonly trl: string
  readonly price: string
}

export function robotCard(robot: Robot): RobotCardView {
  return {
    id: robot.id,
    name: robot.name,
    vendor: `${shortManufacturer(robot.manufacturer)} · ${robot.subtype}`,
    trl: t.robots.trl(robot.trl === null ? t.requirements.noUnit : formatNumber(robot.trl)),
    price: robot.priceRub === null ? t.robots.noPrice : formatRubCompact(robot.priceRub, { fractionDigits: 2 }),
  }
}

/** Значение параметра на локации; нет переопределения — база датасета (как в фикстурах локаций). */
function numberParameter(location: Location, parameters: readonly FacilityParameter[], code: string | null): number | null {
  if (code === null) return null
  const value = location.parameters[code]?.value ?? parameters.find((p) => p.code === code)?.base
  return typeof value === 'number' ? value : null
}

interface Staffing {
  readonly role: string
  readonly headcount: number | null
  readonly salaryRub: number | null
  readonly timeShare: number
}

/** Кто выполняет процесс: группа из профиля локации, иначе — численность и оклад из датасета типа объекта. */
function staffing(process: Process, lp: LocationProcess, location: Location, parameters: readonly FacilityParameter[]): Staffing | null {
  const worker = lp.workers[0]
  const role = worker?.role ?? process.defaultWorkerRole
  if (role === null) return null
  const timeShare = worker?.timeShare ?? 1
  const group = location.staffGroups.find((g) => g.role === role)
  if (group) return { role, headcount: group.headcount, salaryRub: group.salaryGrossMonthRub, timeShare }
  const fromDataset = STAFF_PARAMETERS[location.facilityType].find((g) => g.role === role)
  return {
    role,
    headcount: fromDataset ? numberParameter(location, parameters, fromDataset.headcount) : null,
    salaryRub: fromDataset ? numberParameter(location, parameters, fromDataset.salary) : null,
    timeShare,
  }
}

export interface LocationRow {
  readonly label: string
  readonly value: string
}

export interface LocationUsage {
  readonly locationId: LocationId
  readonly locationProcessId: LocationProcessId
  readonly heading: string
  readonly locationName: string
  readonly rows: readonly LocationRow[]
}

export interface LocationUsageInput {
  readonly process: Process
  readonly locations: readonly Location[]
  readonly locationProcesses: readonly LocationProcess[]
  readonly facilityTypes: readonly FacilityType[]
  readonly parameters: Readonly<Partial<Record<FacilityTypeCode, readonly FacilityParameter[]>>>
}

/**
 * Процесс на локациях (PRD 9.3): пиковая = объём ÷ часы × пиковый коэффициент профиля;
 * стоимость труда = численность × оклад × 12 × начисления × доля времени на процессе. Округление — только при показе (D-19).
 */
export function locationUsages({ process, locations, locationProcesses, facilityTypes, parameters }: LocationUsageInput): readonly LocationUsage[] {
  return locationProcesses
    .filter((lp) => lp.processCode === process.code)
    .flatMap((lp) => {
      const location = locations.find((l) => l.id === lp.locationId)
      if (!location) return []
      const params = parameters[location.facilityType] ?? []
      const d = { ...process.defaults, ...lp.overrides }
      const unit = process.volumeUnit
      const peakFactor = numberParameter(location, params, PEAK_FACTOR_PARAMETER[location.facilityType]) ?? d.peakFactor ?? 1
      const peak = (d.dailyVolume / d.workHoursPerDay) * peakFactor
      const staff = staffing(process, lp, location, params)
      const payrollCoef = numberParameter(location, params, PAYROLL_COEF_PARAMETER[location.facilityType])
      const laborCost = staff?.headcount != null && staff.salaryRub != null && payrollCoef !== null
        ? staff.headcount * staff.salaryRub * MONTHS_PER_YEAR * payrollCoef * staff.timeShare
        : null
      const facility = facilityTypes.find((f) => f.code === location.facilityType)?.name ?? location.facilityType
      return [{
        locationId: location.id,
        locationProcessId: lp.id,
        heading: t.locations.heading(location.name, facility),
        locationName: location.name,
        rows: [
          { label: t.locations.demand, value: ru.processes.card.volume(formatNumber(d.dailyVolume), unit, process.volumePeriod ?? 'day') },
          { label: t.locations.peak, value: `${formatNumber(peak)} ${rateUnit(process)}` },
          {
            label: t.locations.workers,
            value: staff?.headcount != null ? t.locations.workersValue(formatCount(staff.headcount, ru.plural.people), staff.role) : staff?.role ?? t.locations.noData,
          },
          { label: t.locations.laborCost, value: laborCost === null ? t.locations.noData : formatRubCompact(laborCost, { perYear: true }) },
          { label: t.locations.target, value: t.locations.targetValue(formatPercent(d.automationShare)) },
        ],
      }]
    })
}

/** Новый проект с уже выбранными локацией и процессом — короткий путь в оценку (PRD 9.3, 11.1; D-33). */
export function newProjectHref(usage: Pick<LocationUsage, 'locationId' | 'locationProcessId'>): string {
  const params = new URLSearchParams({ new: '1', locationId: usage.locationId, locationProcessId: usage.locationProcessId })
  return `${ROUTE_PATHS.projects}?${params.toString()}`
}

/** Каталог с фильтром по классу процесса (PRD 9.3). Фильтр — в адресе, чтобы ссылкой можно было поделиться. */
export function catalogHref(classCode: string): string {
  return `${ROUTE_PATHS.catalog}?${new URLSearchParams({ class: classCode }).toString()}`
}
