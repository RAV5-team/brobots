import type { SimulationTrace, TraceNode } from '@/domain'
import { ContractError } from '../contract'

/**
 * Трасса GET /api/simulations/{id}/traces. В openapi.json — «массив объектов» без схемы (docs/api-contract.md, №6),
 * поэтому тип описан по simcore.viz.export_trace, а ответ проверяется здесь.
 */
export interface SimulationTraceDto {
  readonly name: string
  readonly step_s: number
  readonly n_robots: number
  readonly n_chargers: number
  readonly clock_offset_h?: number
  readonly states: readonly string[]
  readonly layout: {
    readonly nodes: readonly { readonly id: string; readonly x: number; readonly y: number; readonly type: string }[]
    readonly edges: readonly { readonly u: string; readonly v: string; readonly kind: string }[]
    readonly charger_slots: readonly (readonly [number, number])[]
    readonly width: number
    readonly depth: number
  }
  readonly frames: readonly { readonly t: number; readonly r: readonly (readonly [number, number, number])[] }[]
}

const ENTITY = 'Trace'
const NODE_TYPES: readonly TraceNode['type'][] = ['junction', 'storage', 'dock_in', 'dock_out', 'charger']

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function field<T>(obj: Record<string, unknown>, key: string, check: (v: unknown) => v is T, where = ENTITY): T {
  const value = obj[key]
  if (!check(value)) throw new ContractError(`${where}: в ответе нет поля «${key}» нужного вида`)
  return value
}

const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'

/** Трасса сервиса → модель плеера. Проверяет формат: число роботов в каждом кадре, узлы и рёбра схемы. */
export function toSimulationTrace(dto: unknown): SimulationTrace {
  if (!isObject(dto)) throw new ContractError(`${ENTITY}: ответ не объект`)
  const robots = field(dto, 'n_robots', isNumber)
  const layout = field(dto, 'layout', isObject)
  const nodes = field(layout, 'nodes', isArray, `${ENTITY}.layout`).map((node) => {
    if (!isObject(node)) throw new ContractError(`${ENTITY}.layout: узел не объект`)
    const type = field(node, 'type', isString, `${ENTITY}.layout.node`)
    if (!(NODE_TYPES as readonly string[]).includes(type)) throw new ContractError(`${ENTITY}.layout: тип узла «${type}» неизвестен`)
    return { id: field(node, 'id', isString), x: field(node, 'x', isNumber), y: field(node, 'y', isNumber), type: type as TraceNode['type'] }
  })
  const edges = field(layout, 'edges', isArray, `${ENTITY}.layout`).map((edge) => {
    if (!isObject(edge)) throw new ContractError(`${ENTITY}.layout: ребро не объект`)
    return { from: field(edge, 'u', isString), to: field(edge, 'v', isString), kind: field(edge, 'kind', isString) }
  })
  const frames = field(dto, 'frames', isArray).map((frame, i) => {
    if (!isObject(frame)) throw new ContractError(`${ENTITY}: кадр ${String(i)} не объект`)
    const positions = field(frame, 'r', isArray)
    if (positions.length !== robots) {
      throw new ContractError(`${ENTITY}: в кадре ${String(i)} роботов ${String(positions.length)}, ожидалось ${String(robots)}`)
    }
    return { t: field(frame, 't', isNumber), robots: positions as readonly (readonly [number, number, number])[] }
  })
  return {
    name: field(dto, 'name', isString),
    stepS: field(dto, 'step_s', isNumber),
    robots,
    chargers: field(dto, 'n_chargers', isNumber),
    clockOffsetH: isNumber(dto.clock_offset_h) ? dto.clock_offset_h : 0,
    states: field(dto, 'states', isArray).map(String),
    layout: {
      nodes,
      edges,
      chargerSlots: field(layout, 'charger_slots', isArray, `${ENTITY}.layout`) as readonly (readonly [number, number])[],
      width: field(layout, 'width', isNumber, `${ENTITY}.layout`),
      depth: field(layout, 'depth', isNumber, `${ENTITY}.layout`),
    },
    frames,
  }
}
