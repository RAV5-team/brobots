import type { Process, ProcessCode } from '@/domain'
import { PROCESSES } from '@/mocks/fixtures/processes'
import type { ProcessService } from '../processes'
import { findOrReject, respond, type MockOptions } from './respond'

/** Код по порядку в библиотеке: PR-0013 после двенадцати процессов источника. */
function nextCode(processes: readonly Process[]): ProcessCode {
  return `PR-${String(processes.length + 1).padStart(4, '0')}`
}

export function createMockProcesses(options: MockOptions): ProcessService {
  // Созданные процессы живут до перезагрузки страницы: фикстуры не меняются.
  let library: readonly Process[] = PROCESSES
  return {
    listProcesses: () => respond(library, options),
    getProcess: (code) => findOrReject(library, (p) => p.code === code, `Процесс ${code} не найден`, options),
    createProcess: (input) => {
      const created: Process = { ...input, code: nextCode(library) }
      library = [...library, created]
      return respond(created, options)
    },
  }
}
