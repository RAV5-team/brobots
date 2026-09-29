import { ROUTE_PATHS as R, type RoutePath } from './routePaths'
import { ECONOMICS_SCREENS } from './screenRows/economics'
import { MATCHING_SCREENS } from './screenRows/matching'
import { PARAMS_SCREENS } from './screenRows/params'
import { PROJECTS_SCREENS } from './screenRows/projects'
import { SIMULATION_SCREENS } from './screenRows/simulation'
import type { ScreenKind, ScreenRow } from './screenRows/types'

// Реестр экранов — копия apps/web/docs/design/screens.md (разделы 1–5) для заглушек и /dev/screens.
export type { ScreenKind } from './screenRows/types'

/** Строки проекта по шагам: каждый поток правит только свой файл в app/screenRows. */
const STEP_ROWS = [PROJECTS_SCREENS, PARAMS_SCREENS, MATCHING_SCREENS, SIMULATION_SCREENS, ECONOMICS_SCREENS]

export const FIGMA_FILE_KEY = 'sd1kJRdpW6RBFzSi1ztXYK'

/**
 * clean — чистовая серия; prototype — прототип шагов проекта (секция 15877:2, D-54); board — доска проекта-оценки 16325:2
 * (справка, экраны сделаны по прототипу); first — первая итерация; pending — ждут чистовых макетов; archive — архив первой итерации.
 */
export type ScreenSeries = 'clean' | 'prototype' | 'board' | 'first' | 'pending' | 'archive'

export interface Screen {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly series: ScreenSeries
  readonly nodeId: string | null
  readonly prd: string
  readonly kind: ScreenKind
  /** null — маршрута пока нет (назначение экрана не определено). */
  readonly route: RoutePath | null
}

const rows = (series: ScreenSeries, list: readonly ScreenRow[]): Screen[] =>
  list.map(([id, code, title, nodeId, prd, kind, route]) => ({
    id, code, title, series, nodeId, prd, kind, route,
  }))

const CLEAN: readonly ScreenRow[] = [
  ['05', '05', 'Вход · авторизация', '15935:17', '4', 'page', R.login],
  ['06', '06', 'Дашборд', '15935:115', '5, 8', 'page', R.dashboard],
  ['07', '07', 'Процессы · список', '15935:268', '9.1', 'page', R.processes],
  ['09а', '09а', 'Процессы · новый процесс вручную', '15935:903', '9.2', 'page', R.processNew],
  ['11', '11', 'Процессы · карточка процесса', '15935:1369', '9.3', 'page', R.process],
  ['12', '12', 'Локации · список', '15950:1627', '10.1', 'page', R.locations],
  ['12а', '12а', 'Локации · список · локация добавлена', '15950:2245', '10.1', 'state', R.locations],
  ['14', '14', 'Локации · новая локация · форма', '15950:1952', '10.2', 'page', R.locationNew],
  ['15', '15', 'Локации · локация создана', '15950:2489', '10.3, 10.4', 'page', R.location],
  ['15а', '15а', 'Локации · выбрать процесс', '15950:2818', '10.4', 'modal', R.location],
  ['16', '16', 'Локации · процесс на локации', '15950:3096', '10.4', 'page', R.locationProcess],
  ['17', '17', 'Локации · процессы локации', '15950:4324', '10.4', 'page', R.locationProcesses],
  ['17а', '17а', 'Локации · параметры объекта', '16005:291', '10.3, 10.5', 'page', R.locationParams],
  ['17б', '17б', 'Локации · документы и история', '16005:1024', '10.3', 'page', R.locationDocuments],
  ['17в', '17в', 'Локации · удалить процесс с локации', '16036:291', '10.4', 'modal', R.locationProcesses],
  ['А1', 'А1', 'Администрирование · каталог решений', '15997:2', '6.2', 'page', R.adminCatalog],
  ['А1а', 'А1а', 'Администрирование · каталог · загрузка', '16044:11', '6.2', 'page', R.adminCatalogImport],
  ['А2', 'А2', 'Администрирование · новый робот', '15966:5992', '6.3', 'page', R.adminCatalogNew],
  ['А3', 'А3', 'Администрирование · робот добавлен', '15966:6268', '6.2', 'state', R.adminCatalog],
  ['А5', 'А5', 'Администрирование · нормативы и допущения', '15997:371', '6.8', 'page', R.adminNorms],
  ['А6', 'А6', 'Администрирование · источники данных', '15966:7246', '6.9', 'page', R.adminSources],
  ['А7', 'А7', 'Администрирование · новый источник · файл', '15966:7450', '6.10', 'modal', R.adminSources],
  ['А7б', 'А7б', 'Администрирование · источник по ссылке', '15966:7711', '6.10', 'modal', R.adminSources],
  ['А8', 'А8', 'Администрирование · классы операций', '15966:8018', '6.7', 'page', R.adminOperationClasses],
  ['А10', 'А10', 'Администрирование · новый класс операции', '15966:8211', '6.7', 'modal', R.adminOperationClasses],
  ['К-1', 'К-1', 'Каталог · список', '16642:619', '7.1, 7.2, 7.5', 'page', R.catalog],
  ['К-2', 'К-2', 'Каталог · выбраны фильтры', '16642:2276', '7.4', 'state', R.catalog],
  ['К-3', 'К-3', 'Каталог · сравнение', '16642:2489', '7.6', 'page', R.catalogCompare],
  ['К-4', 'К-4', 'Каталог · карточка решения', '16777:783', '7.7', 'page', R.catalogItem],
]

const FIRST: readonly ScreenRow[] = [
  ['first-А4', 'А4', 'Обновление каталога · предпросмотр изменений', '14593:1014', '6.6', 'page', null],
  ['first-journal', 'Журнал', 'Администрирование · журнал изменений', '14581:50271', '6.11', 'page', R.adminJournal],
  ['first-journal-filter', 'Журнал · фильтр', 'Журнал · фильтр по разделам', '14930:7', '6.11', 'state', R.adminJournal],
  ['first-catdrop', '—', 'Каталог · список «Задача» (подпись устарела, D-12) — удалён из Figma, ждёт скрытую секцию (15835:11139)', null, '7.4', 'state', R.catalog],
  ['first-catind', '—', 'Каталог · список «Отрасль» — удалён из Figma, ждёт скрытую секцию (15835:11139)', null, '7.4', 'state', R.catalog],
  ['first-catready', '—', 'Каталог · список «Готовность» — удалён из Figma, ждёт скрытую секцию (15835:11139)', null, '7.4', 'state', R.catalog],
  ['first-catcost', '—', 'Каталог · список «Стоимость» — удалён из Figma, ждёт скрытую секцию (15835:11139)', null, '7.4', 'state', R.catalog],
  ['first-catsort', '—', 'Каталог · сортировка — удалён из Figma, ждёт скрытую секцию (15835:11139)', null, '7.4', 'state', R.catalog],
  ['first-procsempty', '—', 'Процессы · список · пусто (D-07)', '15918:2', '14', 'state', R.processes],
  ['first-locsempty', '—', 'Локации · список · пусто (D-07)', '15919:2', '14', 'state', R.locations],
  ['first-locprocsempty', '—', 'Локации · процессы · пусто (D-07)', '15919:241', '14', 'state', R.locationProcesses],
  ['first-dashempty', '—', 'Дашборд · пусто (D-07)', '15919:556', '14', 'state', R.dashboard],
]

/** Экраны проекта первой итерации: устарели в PRD 0.9, маршрутов нет (screens.md, раздел 5). */
const ARCHIVE: readonly ScreenRow[] = [
  ['first-12', '12', 'Подбор', '14581:43031', '11.2', 'page', null],
  ['first-12a', '12a', 'Подбор · изменить условия', '14587:1049', '11.2.7', 'modal', null],
  ['first-12b', '12b', 'Подбор · как рассчитано', '14587:2', '11.2.9', 'modal', null],
  ['first-12c', '12c', 'Подбор · веса критериев', '14587:534', '11.2.8', 'modal', null],
  ['first-12d', '12d', 'Подбор · не для всех задач', '14581:45751', '11.2.10', 'modal', null],
  ['first-14', '14', 'Экономика', '14581:44407', '11.4', 'page', null],
  ['first-14a', '14a', 'Экономика · допущения и нормативы', '14588:357', '11.4.7', 'modal', null],
  ['first-14b', '14b', 'Экономика · формулы и источники', '14588:757', '11.4.8', 'modal', null],
  ['first-14c', '14c', 'Экономика · состав CAPEX и OPEX', '14588:1407', '11.4.6', 'modal', null],
  ['first-14d', '14d', 'Экономика · анализ устойчивости', '14588:2', '11.4.5', 'modal', null],
  ['first-14e', '14e', 'Экономика · журнал изменений расчёта', '14588:1104', '11.4.9', 'modal', null],
]

/** Проект — прототип, секция 15877:2: шаг 4 (D-54). id сценариев — в pages/dev/screenScenarios. Строки по шагам — app/screenRows. */
const PROTOTYPE: readonly ScreenRow[] = STEP_ROWS.flatMap((step) => step.prototype)

/** Доска «user flow · проект-оценка» 16325:2: шаги 1–3 (D-54). Строки по шагам — app/screenRows. */
const BOARD: readonly ScreenRow[] = STEP_ROWS.flatMap((step) => step.board)

const PENDING: readonly ScreenRow[] = [
  ['pending-integrations', '—', 'Интеграции', null, '12', 'page', R.integrations],
  ['pending-profile', '—', 'Профиль и уведомления', null, '5.2', 'page', R.profile],
  ['pending-help', '—', 'Справка и методика', null, '5.2', 'page', R.help],
  ['pending-A01', 'A01', 'Неизвестный экран (открытый вопрос PRD)', null, '6.12', 'page', null],
]

export const SCREENS: readonly Screen[] = [
  ...rows('clean', CLEAN),
  ...rows('prototype', PROTOTYPE),
  ...rows('board', BOARD),
  ...rows('first', FIRST),
  ...rows('pending', PENDING),
  ...rows('archive', ARCHIVE),
]

export const SERIES_TITLES: Record<ScreenSeries, string> = {
  clean: 'Чистовая серия',
  prototype: 'Проект · прототип 15877:2',
  board: 'Проект-оценка · доска 16325:2 (справка)',
  first: 'Первая итерация',
  pending: 'Ждут чистовых макетов',
  archive: 'Архив первой итерации',
}

export const figmaUrl = (nodeId: string): string =>
  `https://www.figma.com/design/${FIGMA_FILE_KEY}/?node-id=${nodeId.replace(':', '-')}`

/** Подставляет демо-идентификаторы вместо параметров маршрута — для ссылок на заглушки. */
export const samplePath = (path: string): string => path.replace(/:[A-Za-z]+/g, 'demo')

export const screensByRoute = (route: RoutePath): Screen[] =>
  SCREENS.filter((s) => s.route === route)
