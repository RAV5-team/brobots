import type { FacilityParameter, FacilityType, FacilityTypeCode, Location, LocationId, LocationProcess } from '@/domain'

/** Локации, их параметры и процессы на площадке (PRD 10). */
export interface LocationService {
  listLocations(): Promise<readonly Location[]>
  getLocation(id: LocationId): Promise<Location>
  listLocationProcesses(locationId: LocationId): Promise<readonly LocationProcess[]>
  listFacilityTypes(): Promise<readonly FacilityType[]>
  listFacilityParameters(facilityType: FacilityTypeCode): Promise<readonly FacilityParameter[]>
}
