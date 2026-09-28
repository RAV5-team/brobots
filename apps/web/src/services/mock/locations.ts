import type {
  Location, LocationDocument, LocationDocumentId, LocationDocumentKind, LocationId, LocationProcess, LocationProcessId,
} from '@/domain'
import { DASHBOARD_INPUTS } from '@/mocks/fixtures/dashboard'
import { FACILITY_PARAMETERS, FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_DOCUMENTS } from '@/mocks/fixtures/locationDocuments'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATION_SUMMARY_INPUTS } from '@/mocks/fixtures/locationSummaries'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { IMAGE_EXTENSIONS, extensionOf } from '@/shared/config/upload'
import { ConflictError, NotFoundError } from '../errors'
import type { LocationService } from '../locations'
import { buildLocationSummary } from './locationSummary'
import { findOrReject, respond, type MockOptions } from './respond'

const SUMMARY_SOURCES = {
  projects: PROJECTS,
  laborCosts: DASHBOARD_INPUTS.laborCosts,
  inputs: LOCATION_SUMMARY_INPUTS,
  parameters: FACILITY_PARAMETERS,
}

/** Id по порядку: LOC-05 после четырёх демо-локаций. */
function nextId(locations: readonly Location[]): LocationId {
  return `LOC-${String(locations.length + 1).padStart(2, '0')}`
}

/** Id процесса площадки — следующий за наибольшим: LP-16 после пятнадцати демо-процессов, и после удаления id не повторяется. */
function nextProcessId(processes: readonly LocationProcess[]): LocationProcessId {
  const last = Math.max(0, ...processes.map((lp) => Number(lp.id.slice('LP-'.length)) || 0))
  return `LP-${String(last + 1).padStart(2, '0')}`
}

/** Id документа по порядку: DOC-05 после четырёх демо-документов. */
function nextDocumentId(documents: readonly LocationDocument[]): LocationDocumentId {
  return `DOC-${String(documents.length + 1).padStart(2, '0')}`
}

const IMAGES: readonly string[] = IMAGE_EXTENSIONS

/** Вид документа по расширению — так его определит сервер. «Схемой» PDF становится только в демо-данных. */
function documentKindOf(extension: string): LocationDocumentKind {
  if (extension === 'dwg') return 'cad'
  if (IMAGES.includes(extension)) return 'photo'
  if (extension === 'xlsx' || extension === 'xls') return 'excel'
  if (extension === 'csv') return 'csv'
  return 'pdf'
}

/** Ссылка на загруженный файл живёт до перезагрузки страницы, как и сам документ мока. */
function objectUrl(file: File): string | null {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
}

export function createMockLocations(options: MockOptions): LocationService {
  // Созданные локации живут до перезагрузки страницы: фикстуры не меняются.
  let locations: readonly Location[] = LOCATIONS
  let locationProcesses: readonly LocationProcess[] = LOCATION_PROCESSES
  let documents: readonly LocationDocument[] = LOCATION_DOCUMENTS
  return {
    listLocations: () => respond(locations, options),
    getLocation: (id) => findOrReject(locations, (l) => l.id === id, `Локация ${id} не найдена`, options),
    createLocation: (input) => {
      const created: Location = { ...input, id: nextId(locations), updatedAt: new Date().toISOString() }
      locations = [...locations, created]
      return respond(created, options)
    },
    updateLocation: (id, input) => {
      const current = locations.find((l) => l.id === id)
      if (!current) return Promise.reject(new NotFoundError(`Локация ${id} не найдена`))
      // Ключ и дата — за сервисом, даже если во входе оказались свои.
      const saved: Location = { ...input, id: current.id, updatedAt: new Date().toISOString() }
      locations = locations.map((l) => (l.id === id ? saved : l))
      return respond(saved, options)
    },
    listLocationSummaries: () =>
      respond(locations.map((l) => buildLocationSummary(l, { ...SUMMARY_SOURCES, processes: locationProcesses })), options),
    listLocationProcesses: (locationId) =>
      respond(locationProcesses.filter((lp) => lp.locationId === locationId), options),
    addLocationProcess: (locationId, processCode) => {
      if (!locations.some((l) => l.id === locationId)) return Promise.reject(new NotFoundError(`Локация ${locationId} не найдена`))
      if (!PROCESSES.some((p) => p.code === processCode)) return Promise.reject(new NotFoundError(`Шаблон ${processCode} не найден`))
      if (locationProcesses.some((lp) => lp.locationId === locationId && lp.processCode === processCode)) {
        return Promise.reject(new ConflictError('Этот шаблон уже на локации'))
      }
      const added: LocationProcess = {
        id: nextProcessId(locationProcesses), locationId, processCode, name: null, overrides: {}, workers: [],
      }
      locationProcesses = [...locationProcesses, added]
      return respond(added, options)
    },
    updateLocationProcess: (id, update) => {
      const current = locationProcesses.find((lp) => lp.id === id)
      if (!current) return Promise.reject(new NotFoundError(`Процесс ${id} на локации не найден`))
      // Ключи копии фиксированы: id, локация и шаблон из запроса не берутся.
      const saved: LocationProcess = { ...current, ...update, id: current.id, locationId: current.locationId, processCode: current.processCode }
      locationProcesses = locationProcesses.map((lp) => (lp.id === id ? saved : lp))
      return respond(saved, options)
    },
    removeLocationProcess: (id) => {
      if (!locationProcesses.some((lp) => lp.id === id)) return Promise.reject(new NotFoundError(`Процесс ${id} на локации не найден`))
      // Сервер архивирует копию; в моке её просто нет в списке. Шаблон и другие локации не трогаем.
      locationProcesses = locationProcesses.filter((lp) => lp.id !== id)
      return respond(undefined, options)
    },
    listLocationDocuments: (locationId) =>
      respond(documents.filter((d) => d.locationId === locationId), options),
    addLocationDocument: (locationId, files) => {
      if (!locations.some((l) => l.id === locationId)) return Promise.reject(new NotFoundError(`Локация ${locationId} не найдена`))
      const [first] = files
      if (!first) return Promise.reject(new Error('Документ без файлов'))
      const extension = extensionOf(first.name)
      const added: LocationDocument = {
        id: nextDocumentId(documents),
        locationId,
        name: first.name,
        extension,
        kind: documentKindOf(extension),
        fileCount: files.length,
        uploadedAt: new Date().toISOString(),
        url: objectUrl(first),
      }
      documents = [...documents, added]
      return respond(added, options)
    },
    listFacilityTypes: () => respond(FACILITY_TYPES, options),
    listFacilityParameters: (facilityType) =>
      respond(FACILITY_PARAMETERS.filter((p) => p.facilityType === facilityType), options),
  }
}
