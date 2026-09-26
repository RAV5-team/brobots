import { FACILITY_PARAMETERS, FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import type { LocationService } from '../locations'
import { findOrReject, respond, type MockOptions } from './respond'

export function createMockLocations(options: MockOptions): LocationService {
  return {
    listLocations: () => respond(LOCATIONS, options),
    getLocation: (id) => findOrReject(LOCATIONS, (l) => l.id === id, `Локация ${id} не найдена`, options),
    listLocationProcesses: (locationId) =>
      respond(LOCATION_PROCESSES.filter((lp) => lp.locationId === locationId), options),
    listFacilityTypes: () => respond(FACILITY_TYPES, options),
    listFacilityParameters: (facilityType) =>
      respond(FACILITY_PARAMETERS.filter((p) => p.facilityType === facilityType), options),
  }
}
