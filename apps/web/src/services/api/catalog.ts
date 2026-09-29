import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import {
  handlingMethodFromOption,
  launchItemFromSummary,
  operationClassFromWorkType,
  robotFromSolution,
  robotFromSummary,
} from '@/api/mappers/catalog'
import { deriveLaunchRequired, type HandlingMethod, type NewRobot, type OperationClassCode, type Robot } from '@/domain'
import type { CatalogService } from '../catalog'
import { PAGE_LIMIT, type Reference } from './reference'

const LAUNCH_KINDS = ['infrastructure', 'software', 'service', 'support'] as const
const STATUS: Readonly<Record<Robot['readiness'], string | null>> = { operation: 'operation', pilot: 'piloting', rnd: 'rnd', unknown: null }

/** Каталог решений (PRD 7) поверх `GET /solutions` и `GET /work-types`. */
export function apiCatalog(http: HttpClient, reference: Reference): Partial<CatalogService> {
  /** Один запрос на вид: повтор, пока первый не завершился, ждёт его же. Ошибка не остаётся в кэше. */
  const kinds = new Map<string, Promise<readonly ApiSchemas['SolutionSummary'][]>>()
  const listKind = (kind: string): Promise<readonly ApiSchemas['SolutionSummary'][]> => {
    const cached = kinds.get(kind)
    if (cached) return cached
    const request = http.get<ApiSchemas['SolutionPage']>('/solutions', { kind, limit: PAGE_LIMIT })
      .then((page) => page.items ?? [])
      .catch((error: unknown) => {
        kinds.delete(kind)
        throw error
      })
    kinds.set(kind, request)
    return request
  }

  const robotNames = async () =>
    (await listKind('robot')).map((r) => ({ id: r.id ?? '', name: r.name ?? '', ...(r.code ? { code: r.code } : {}) }))

  const listLaunchItems: CatalogService['listLaunchItems'] = async (types) => {
    const requested = types ?? LAUNCH_KINDS
    const [rows, names] = await Promise.all([Promise.all(requested.map((kind) => listKind(kind))), robotNames()])
    return rows.flat().map((row) => launchItemFromSummary(row, names))
  }

  const toSolutionInput = async (input: NewRobot): Promise<ApiSchemas['SolutionInput']> => ({
    kind: 'robot',
    name: input.name,
    manufacturer: input.manufacturer,
    typeGroup: input.type,
    solutionType: input.subtype,
    status: STATUS[input.readiness],
    trl: input.trl,
    ...(input.priceRub === null ? {} : { price: { amountRub: input.priceRub, unit: 'item', includesVat: true } }),
    spec: {
      payloadKg: input.specs.payloadKg ?? null,
      lengthMm: input.specs.lengthMm ?? null,
      widthMm: input.specs.widthMm ?? null,
      heightMm: input.specs.heightMm ?? null,
      maxSpeedMps: input.specs.maxSpeedMps ?? null,
      autonomyH: input.specs.autonomyH ?? null,
      chargeTimeMin: input.specs.chargeTimeMin ?? null,
      avgPowerKw: input.specs.avgPowerKw ?? null,
      loadTimeS: input.specs.loadTimeS ?? null,
      unloadTimeS: input.specs.unloadTimeS ?? null,
      minTempC: input.specs.minTempC ?? null,
      maxTempC: input.specs.maxTempC ?? null,
      handlingMethodCode: input.specs.handlingMethod ?? null,
      specsConfirmed: input.specs.confidence === 'confirmed' ? 'yes' : input.specs.confidence === 'partial' ? 'partial' : 'no',
    },
    workTypeIds: await Promise.all(input.operationClasses.map((c) => reference.workTypeId(c.code))),
  })

  return {
    listRobots: async (filter = {}) => {
      const robots = (await listKind('robot')).map(robotFromSummary)
      const { operationClass } = filter
      return operationClass === undefined ? robots : robots.filter((r) => r.operationClasses.some((c) => c.code === operationClass))
    },
    getRobot: async (id) => {
      const [dto, items] = await Promise.all([http.get<ApiSchemas['Solution']>(`/solutions/${id}`), listLaunchItems()])
      const robot = robotFromSolution(dto)
      return { ...robot, launchRequired: deriveLaunchRequired(robot.id, items) }
    },
    createRobot: async (input) => {
      const created = await http.post<ApiSchemas['Solution']>('/solutions', await toSolutionInput(input))
      return robotFromSolution(created)
    },
    listLaunchItems,
    listOperationClasses: async () => (await reference.workTypes()).map(operationClassFromWorkType),
    createOperationClass: async (input) => {
      const created = await http.post<ApiSchemas['WorkType']>('/work-types', {
        name: input.name,
        description: input.description,
        unitLabel: input.unit,
        typicalCarriers: input.typicalCarriers.join(', '),
        exampleProcesses: input.exampleProcesses.join(', '),
      } satisfies ApiSchemas['WorkTypeInput'])
      reference.invalidate('workTypes')
      return operationClassFromWorkType(created)
    },
    countRobotsByClass: async () => {
      const types = await reference.workTypes()
      return Object.fromEntries(types.filter((w) => w.code).map((w) => [w.code, w.robotsCount ?? 0])) as Record<OperationClassCode, number>
    },
    listHandlingMethods: async () => {
      const options = (await reference.dictionaries()).handlingMethods ?? []
      return options.map(handlingMethodFromOption).filter((m): m is HandlingMethod => m !== null)
    },
  }
}
