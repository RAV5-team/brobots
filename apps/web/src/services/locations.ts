import type {
  FacilityParameter, FacilityType, FacilityTypeCode, Location, LocationDocument, LocationId, LocationProcess, LocationProcessId, LocationProcessUpdate,
  LocationSummary, NewLocation, ProcessCode,
} from '@/domain'

/** Локации, их параметры и процессы на площадке (PRD 10). */
export interface LocationService {
  listLocations(): Promise<readonly Location[]>
  getLocation(id: LocationId): Promise<Location>
  /** Сохранить локацию из формы 14; вернёт её с присвоенным id — после этого список показывает состояние 12а. */
  createLocation(input: NewLocation): Promise<Location>
  /**
   * Сохранить профиль с вкладки «Параметры объекта» (17а, PRD 10.3) — `PUT /locations/{id}`.
   * id не меняется, дата изменения — момент сохранения. Нет такой локации — `NotFoundError`.
   */
  updateLocation(id: LocationId, input: NewLocation): Promise<Location>
  /** Сводки для карточек списка (экран 12, PRD 10.1) — `summary` у `GET /locations`. */
  listLocationSummaries(): Promise<readonly LocationSummary[]>
  listLocationProcesses(locationId: LocationId): Promise<readonly LocationProcess[]>
  /**
   * Привязать к локации копию шаблона из справочника (окно 15а, PRD 10.4) — `POST /locations/{id}/tasks`.
   * Значения копии — шаблонные, пока их не переопределят на форме 16; справочник не меняется.
   * Шаблон уже на локации — `ConflictError`.
   */
  addLocationProcess(locationId: LocationId, processCode: ProcessCode): Promise<LocationProcess>
  /**
   * Сохранить значения копии с формы 16 (PRD 10.4) — `PATCH /tasks/{id}`. Меняется только эта копия:
   * шаблон в справочнике и другие локации не меняются. Нет такого процесса — `NotFoundError`.
   */
  updateLocationProcess(id: LocationProcessId, update: LocationProcessUpdate): Promise<LocationProcess>
  /**
   * Снять процесс с локации (окно 17в, PRD 10.4) — `DELETE /tasks/{id}`, сервер архивирует копию.
   * Шаблон в справочнике и другие локации не меняются. Нет такого процесса — `NotFoundError`.
   */
  removeLocationProcess(id: LocationProcessId): Promise<void>
  /** Документы обследования локации (вкладка 17б, PRD 10.3) — `GET /locations/{id}/documents` (предложение, D-42). */
  listLocationDocuments(locationId: LocationId): Promise<readonly LocationDocument[]>
  /**
   * Приложить документ к локации — `POST /locations/{id}/documents` (multipart, предложение, D-42).
   * Несколько файлов — один документ-группа («фото · 10 файлов»); вид документа сервис определяет по расширению.
   * Нет такой локации — `NotFoundError`. Формат и размер проверяются до отправки (D-18).
   */
  addLocationDocument(locationId: LocationId, files: readonly File[]): Promise<LocationDocument>
  listFacilityTypes(): Promise<readonly FacilityType[]>
  listFacilityParameters(facilityType: FacilityTypeCode): Promise<readonly FacilityParameter[]>
}
