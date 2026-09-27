import type { CatalogRefresh, DataSource, DataSourcePatch, DataSourceUrlCheck, NewDataSource, Norm, NormChange } from '@/domain'

/** Администрирование: источники данных (PRD 6.9), обновление каталога по запросу (PRD 6.2, А1а) и нормативы (PRD 6.8, А5). */
export interface AdminService {
  listDataSources(): Promise<readonly DataSource[]>
  /**
   * Добавить источник (POST /data-sources, окно А7); вернёт его с ключом реестра.
   * Автообновление у файла или название, которое уже есть в реестре, — ValidationError (PRD 6.10).
   */
  createDataSource(input: NewDataSource): Promise<DataSource>
  /**
   * Изменить источник (PATCH /data-sources): сейчас — режим автообновления.
   * Нет источника — NotFoundError; автообновление у файла — ValidationError (PRD 6.10).
   */
  updateDataSource(key: string, patch: DataSourcePatch): Promise<DataSource>
  /**
   * «Проверить» ссылку до добавления источника (окно А7б): открывается ли страница и когда она менялась.
   * Эндпоинта в API пока нет (D-42). Недоступная страница — итог `reachable: false`, а не ошибка; сбой сервиса — ошибка.
   */
  checkDataSourceUrl(url: string): Promise<DataSourceUrlCheck>
  /** Перечитать источник по запросу («Обновить» на А6); вернёт источник с новой датой актуализации. */
  refreshDataSource(key: string): Promise<DataSource>
  /** Запустить опрос источников каталога; вернёт первый снимок. */
  startCatalogRefresh(): Promise<CatalogRefresh>
  /** Текущий снимок опроса — экран опрашивает его, пока все источники не ответят. */
  getCatalogRefresh(): Promise<CatalogRefresh>
  /** Справочник нормативов и допущений по умолчанию в порядке экрана А5. */
  listNorms(): Promise<readonly Norm[]>
  /**
   * Сохранить новые значения одной версией справочника (PRD 6: изменение пишется в журнал и создаёт версию данных).
   * Вернёт справочник после сохранения. Неизвестный код — ошибка, справочник не меняется.
   */
  saveNorms(changes: readonly NormChange[]): Promise<readonly Norm[]>
}
