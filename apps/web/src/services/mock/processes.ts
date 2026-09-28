import { modelNormsFrom, type Process, type ProcessCode, type ProcessRequirements } from '@/domain'
import { NORMS } from '@/mocks/fixtures/norms'
import { ENVIRONMENT_REQUIREMENTS, REQUIREMENTS_FROM_MOCKUP } from '@/mocks/fixtures/processRequirements'
import { PROCESS_DEMO_TEXT, PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { NotFoundError } from '../errors'
import type { ProcessService } from '../processes'
import { findOrReject, respond, type MockOptions } from './respond'

/** Код по порядку в библиотеке: PR-0013 после двенадцати процессов источника. */
function nextCode(processes: readonly Process[]): ProcessCode {
  return `PR-${String(processes.length + 1).padStart(4, '0')}`
}

/** Требования процесса без макета: масса — если есть груз, дистанция — если задана длина маршрута (D-33). */
function requirementsOf(process: Process): ProcessRequirements {
  const d = process.defaults
  const drawn = REQUIREMENTS_FROM_MOCKUP[process.code] ?? {
    required: [
      ...(d.unitMassKg === undefined ? [] : [{ code: 'maxMass', unit: 'kg' } as const]),
      { code: 'routeWidth', unit: 'm' },
    ],
    desirable: [
      ...(d.routeLengthM === undefined ? [] : [{ code: 'avgDistance', unit: 'm' } as const]),
      { code: 'peakFactor', unit: null },
    ],
  }
  return { ...drawn, environment: ENVIRONMENT_REQUIREMENTS }
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
    // Запас по ширине — из справочника нормативов: одно определение для формы 09а, шага 1 и сравнения каталога.
    getTemplateDefaults: () => respond({ ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: modelNormsFrom(NORMS).widthMarginM }, options),
    getDemoText: () => respond(PROCESS_DEMO_TEXT, options),
    getRequirements: (code) => {
      const process = library.find((p) => p.code === code)
      return process ? respond(requirementsOf(process), options) : Promise.reject(new NotFoundError(`Процесс ${code} не найден`))
    },
  }
}
