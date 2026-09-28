import { addEntry, COMPARE_LIMIT, removeEntry, type CompareEntry, type Role } from '@/domain'
import type { CompareService } from '../compare'
import { ValidationError } from '../errors'
import { respond, type MockOptions } from './respond'

export const COMPARE_STORAGE_KEY = 'rav5.compare.v1'

/** Записанный набор из sessionStorage: чужое или повреждённое значение — пустой набор. */
function parseStored(raw: string | null): readonly CompareEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((e): e is CompareEntry =>
        typeof e === 'object' && e !== null
        && ((e as CompareEntry).kind === 'robot' || (e as CompareEntry).kind === 'launch-item')
        && typeof (e as CompareEntry).id === 'string')
      .slice(0, COMPARE_LIMIT)
  } catch {
    return []
  }
}

function readSession(): readonly CompareEntry[] {
  try {
    return parseStored(sessionStorage.getItem(COMPARE_STORAGE_KEY))
  } catch {
    return []
  }
}

function writeSession(entries: readonly CompareEntry[]) {
  try {
    sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Хранилище недоступно (приватный режим): набор остаётся до перезагрузки — в памяти мока.
  }
}

/**
 * Мок набора сравнения (D-69): у гостя — только в памяти, без сохранения (ТЗ 3.1.2);
 * у пользователя и администратора — sessionStorage до конца сессии браузера.
 */
export function createMockCompare(options: MockOptions): CompareService {
  let guest: readonly CompareEntry[] = []
  let session: readonly CompareEntry[] | null = null

  const read = (role: Role) => (role === 'guest' ? guest : (session ??= readSession()))
  const write = (role: Role, entries: readonly CompareEntry[]) => {
    if (role === 'guest') {
      guest = entries
      return
    }
    session = entries
    writeSession(entries)
  }

  return {
    list: (role) => respond(read(role), options),
    add: (role, entry) => {
      const next = addEntry(read(role), entry)
      if (!next) return Promise.reject(new ValidationError({ kind: 'compareLimit', limit: COMPARE_LIMIT }, `В сравнении уже ${String(COMPARE_LIMIT)} позиции`))
      write(role, next)
      return respond(next, options)
    },
    remove: (role, entry) => {
      const next = removeEntry(read(role), entry)
      write(role, next)
      return respond(next, options)
    },
    clear: (role) => {
      write(role, [])
      return respond([], options)
    },
  }
}
