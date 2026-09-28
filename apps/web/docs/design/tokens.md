# Токены

Источник значений — `apps/web/docs/design/audit.json`: аудит `apps/web/docs/design/figma-audit.js`, только фреймы «экран · …» секции `dev` (25 экранов).
Реализация:
- `apps/web/src/styles/tokens.css` — CSS-переменные с префиксом `--rav-` (в таблицах ниже префикс опущен: `--color-bg` = `--rav-color-bg`);
- `apps/web/src/styles/theme.css` — `@theme inline` Tailwind ссылается на `--rav-*`: `bg-bg`, `text-text-secondary`, `rounded-md`, `shadow-raised-sm`, `p-12`. Цвета, тени, радиусы, шрифты и шаг отступов Tailwind по умолчанию отключены;
- `apps/web/src/styles/typography.css` — составные классы `type-*` (семейство, вес, размер, межстрочный, межбуквенный). Текст — только через них.
Витрина: `/dev/tokens`. Частота — вхождения в audit.json вместе со слитыми вариантами; «слито» — какие варианты сведены к токену.

## Цвета
| Токен | Значение | Частота | Роль | Слито |
|---|---|---|---|---|
| --color-bg | #f0eee9 | 426 | фон страницы и неоморфных поверхностей | #f4f2ee (1) |
| --color-surface-sunken | #e6e2da | 350 | статичные утопленные панели и плашки («Уточнения и проверки» 06, счётчик «36 роботов» 07) | #e7e3db (50), #dad6cd (1) |
| --color-surface-muted | #e9e5de | 263 | поля и интерактивные плитки (поиск 07, карточка пользователя в sidebar 06, плитка оценки 11) | — |
| --color-border | #ddd8cf | 123 | границы, разделители | — |
| --color-border-strong | #b9b3a7 | 11 | усиленная граница | — |
| --color-border-control | #8a867d | 58 | обводка контролов | — |
| --color-highlight | rgb(255 255 255 / 0.6) | 239 | светлая кромка неоморфных элементов | белый 0.55 (30) |
| --color-text | #111111 | 1514 | основной текст | #1b1b1a (3), #161616 (1) |
| --color-text-secondary | #5e5e59 | 1087 | вторичный текст; неактивные вкладки и сегменты | #6b675f (2), #3f3f3b (20) |
| --color-text-muted | #8a867d | 395 | подписи, мета-строки; контраст 3.13 — D-23 | — |
| --color-text-disabled | #b9b3a7 | 7 | неактивный текст | — |
| --color-inverse | #111111 | 196 | тёмные кнопки, активный пункт меню, бейджи | — |
| --color-on-inverse | #d9f24a | 133 | текст и значки на тёмном | — |
| --color-accent | #d9f24a | 15 | акцентные заливки на тёмном: точка навигации 09а, прогресс А1а, бейдж «✓» А3 | — |
| --color-accent-surface | #e4f33d | 27 | лаймовые блоки и плашки на светлом (блок демо-объектов 05, «подтверждено» А6/А7) | — |
| --color-on-accent | #4a4f16 | 15 | текст на лаймовом | — |
| --color-accent-border | #c9d62a | 2 | край акцентных элементов | — |
| --color-danger | #ce2c31 | 8 | ошибки, «Выйти» | — |
| --color-danger-border | #e5484d | 1 | обводка поля с ошибкой | — |
| --color-danger-bg | #f7e3de | 1 | фон ошибки | — |
| --color-scrim | rgb(17 17 17 / 0.32) | 5 | подложка модалки | — |

Не токены: #d9d9d9 (81) — прямоугольники и эллипсы `merged › bridge` внутри тёмных фреймов (элементы формы, а не заглушки изображений); #eeeeee в экранах не встречается; IMAGE (1).

## Типографика
Класс — `type-<токен>`, вес по умолчанию — первый в колонке «Шрифт» (переопределяется `font-medium` / `font-semibold`). Onest 400 / 500 / 600 и Unbounded 300, локально через `@fontsource` (D-08). Межбуквенный 0.1 px везде отброшен; `auto` заменён фиксированным межстрочным этого размера.

| Токен | Шрифт | Размер / межстрочный | Межбуквенный | Частота | Слито |
|---|---|---|---|---|---|
| display-xl | Unbounded 300 | 64/72 | −0.02em | 1 | — заголовок экрана входа 05 (15935:30), аудит его не нашёл; D-28 |
| display-lg | Unbounded 300 | 32/40 | −0.02em | 33 | без ls (9) |
| display-md | Unbounded 300 | 28/38 | −0.01em | 2 | — |
| display-sm | Unbounded 300 | 24/32 | — | 3 | 24/31 (3) |
| title-lg | Onest 600 | 24/32 | — | 16 | — |
| title-md | Onest 600 (500) | 20/28 | — | 41 | Medium 20/auto (6) |
| title-sm | Onest 600 | 18/24 | — | 25 | 18/auto (25) |
| heading | Onest 600 (500) | 16/24 | — | 123 | 16/auto (8), Medium 16/24 (9) |
| body | Onest 400/500/600 | 14/20 | — | 1295 | 14/auto (161), 14/22 (4) |
| label | Onest 500/600 | 14/18 | — | 44 | SemiBold 14/16 (7) |
| body-sm | Onest 400/500 | 13/18 | — | 85 | 13/19 (61), 13/16 (8) |
| caption | Onest 400/500/600 | 12/16 | — | 1248 | 12/auto (185), 12/17 (7), ls 0.1 px (560) |
| overline | Onest 500, UPPERCASE | 11/16 | 0.08em | 137 | 11/auto ls 6–8 % (47), 12/17 ls 8 % (2) |
| caption-xs | Onest 400 | 11/16 | 0.04em | 48 | ls 0.1 px (24) |

Не токен: Unbounded Regular 14/22 (2) — логотип, отдельный компонент `Logo` с утилитой `type-logo` (Unbounded 300 14/22, D-28).

## Радиусы
| Токен | Значение | Частота | Слито |
|---|---|---|---|
| --radius-xs | 4px | 6 | — |
| --radius-sm | 7px | 49 | — |
| --radius-md | 12px | 208 | — |
| --radius-lg | 16px | 49 | — |
| --radius-xl | 24px | 4 | 20 (1) |
| --radius-2xl | 28px | 111 | — |
| --radius-3xl | 32px | — | правые углы sidebar (15935:207); аудит не считает радиусы отдельных углов — добавлено на этапе 3 (D-25) |
| --radius-full | 999px | 949 | — |

## Отступы
`--space-2 … --space-40`: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40. В Tailwind класс равен пикселям: `p-12` = 12px, `gap-8` = 8px; других значений нет.
Размеры контролов из components.md — `--size-18, 36, 38, 44, 48` в той же шкале: `size-18` (checkbox, radio), `h-36` (icon-кнопка, option), `h-38` (компактный input), `h-44` (input, search, segmented), `h-48` (кнопка 206×48).
Произвольные значения вида `h-[44px]`, `bg-[#e6e2da]` для цветов и значений шкалы запрещены — проверяет `apps/web/src/styles/classnames.test.ts`.
`--sidebar-width: 240px` (утилиты `w-sidebar`, `pl-sidebar`). `--dashboard-result-width: 168px` и `--dashboard-aside-width: 380px` — колонка «Результат» и панель «Локации» экрана 06 (15935:158, 15935:179), `w-(--rav-dashboard-…)`. `--login-width: 966px` — колонка экрана входа 05 (1366 − 2 × 200), `max-w-(--rav-login-width)`. `--form-rail-width: 300px` — правая панель форм (09а «Проверка шаблона», 15935:1254); `--staff-count-width: 102px`, `--staff-salary-width: 122px`, `--staff-share-width: 152px` (колонки 90 / 110 / 152 плюс зазор 12, у последней его нет) — колонки таблицы исполнителей 09а (15935:1132); `--location-staff-count-width: 120px`, `--location-staff-salary-width: 160px` — колонки таблицы групп персонала формы локации 14 (15950:2091); `--form-nav-offset: 72px` — отступ якоря секции под липкой навигацией формы (D-31). `--location-card-height: 408px` — высота карточки списка локаций 12 (15950:1666): `min-h-(--rav-location-card-height)` у карточки и `h-(--rav-location-card-height)` у скелетона. `--template-list-height: 396px` — наибольшая высота списка шаблонов в окне 15а (15950:3033), дальше список прокручивается: `max-h-(--rav-template-list-height)`. `--empty-panel-pad-x: 64px`, `--empty-panel-pad-y: 88px`, `--empty-panel-min-height: 450px` — панель пустого раздела `EmptyState size="lg"` (15919:552, D-40). `--op-class-code-width: 136px`, `--op-class-robots-width: 146px`, `--op-class-processes-width: 170px` — колонки таблицы классов операций А8 (15966:8042: 120 / 130 / 170 плюс зазор 16, у последней его нет), `w-(--rav-op-class-…)`. `--sources-status-width: 146px`, `--sources-provides-width: 216px`, `--sources-actualized-width: 126px`, `--sources-refresh-width: 166px`, `--sources-action-width: 160px` — колонки реестра источников А6 (15966:7275: 130 / 200 / 110 / 150 плюс зазор 16, колонка действия 160 без зазора; «Источник» занимает остаток), `w-(--rav-sources-…)`. `--catalog-classes-width: 162px`, `--catalog-payload-width: 152px`, `--catalog-price-width: 122px`, `--catalog-updated-width: 112px`, `--catalog-completeness-width: 112px`, `--catalog-action-width: 98px` — колонки таблицы каталога А1 (15997:38: 150 / 140 / 110 / 100 / 100 плюс зазор 12, колонка действия 98 без зазора; «Решение» занимает остаток), `w-(--rav-catalog-…)`. `--robot-photo-width: 200px`, `--robot-photo-height: 140px` — плитка фото карточки робота А2 (15966:6183), `--robot-dropzone-height: 172px` — зона перетаскивания рядом с ней (15966:6188), `--field-hinted-height: 92px` — ряд полей с местом под подсказку в секции 1 А2 (15966:6007), `w-(--rav-robot-…)`. `--catalog-photo-height: 120px` — плашка фото карточки каталога К-1 (16642:672), `h-(--rav-catalog-photo-height)`. `--multiselect-width: 280px` — панель `MultiSelectFilter`: макета нет (D-66), ширина — по самому длинному значению «Отрасли». `--projects-location-width: 166px`, `--projects-status-width: 192px`, `--projects-money-width: 116px` (CAPEX и OPEX), `--projects-payback-width: 120px`, `--projects-action-width: 36px` — колонки списка проектов A1 (16362:8226: 150 / 160 / 110 / 110 / 120 плюс зазор 16 таблицы `roomy`, действие 36 без зазора; «Название» занимает остаток), `w-(--rav-projects-…)`. Статус шире макета на 16 (176): подпись черновика «остановились на: Параметры» — 169 px (D-83); 16 взяты у окупаемости (104). Зазор таблицы 16 вместо 12 макета отдают CAPEX и OPEX (по 100), чтобы «Название» не стало уже 280. Зазоры 571 и −6 — артефакты вёрстки, не токены. `--hour-grid-cell-height: 26px`, `--hour-grid-label-width: 72px` — ячейка часа и подпись ряда «Приёмка» / «Отгрузка» сетки `HourGrid` (05, 16197:1543; ряд подписан, потому что рядов два — D-102), `h-(--rav-hour-grid-cell-height)`, `w-(--rav-hour-grid-label-width)`. `--hourly-table-label-width: 214px`, `--hourly-table-min-width: 1030px` — подпись строки и ширина таблицы «Что происходило по часам» 07a (16198:217: 214 + 24 × 34; уже — прокрутка внутри карточки), ячейка — та же `--hour-grid-cell-height`; `--player-field-height: 230px` — поле 2D-плеера 07a (16198:736), `h-(--rav-player-field-height)` (D-105). `--report-width: 1240px`, `--report-pad: 100px` — лист отчёта 09 на экране (16197:2318: ширина 1240, поля 100; D-15, D-107), `w-(--rav-report-width)`, `p-(--rav-report-pad)`; в печати лист — по ширине A4. `--report-label-width: 320px` — колонка подписей таблиц «показатель — значение» отчёта.

## Тени
Неоморфные пары, blur Figma = blur CSS.

| Токен | box-shadow | Частота | Слито |
|---|---|---|---|
| --shadow-raised-sm | -2px -2px 6px rgb(255 255 255 / .85), 2px 2px 6px rgb(185 179 167 / .30) | 212 | вариант с чёрным .06 / белым .90 (7) |
| --shadow-raised-md | -5px -5px 14px rgb(255 255 255 / .85), 5px 5px 14px rgb(185 179 167 / .30) | 61 | — |
| --shadow-raised-lg | -8px -8px 22px rgb(255 255 255 / .85), 8px 8px 22px rgb(185 179 167 / .30) | 74 | тёмная половина без светлой (25) — sidebar 240×768 у левого края экрана: светлая часть уходит за край, визуально то же самое |
| --shadow-inset-sm | inset 2px 2px 4px rgb(185 179 167 / .60), inset -2px -2px 4px rgb(255 255 255 / .95) | 194 | — |
| --shadow-inset-md | inset 3px 3px 8px rgb(185 179 167 / .30), inset -3px -3px 8px rgb(255 255 255 / .80) | 46 | .50/.90 (4), .60/.95 (3) |
| --shadow-popover | 0 3px 8px rgb(0 0 0 / .18) | 73 | — |
| --drop-shadow-popover | `filter: drop-shadow(0 3px 4px rgb(0 0 0 / .18))` | — | та же тень для составных фигур (активный пункт меню со счётчиком): box-shadow двоился бы на перемычке. Figma drop-shadow 4 px ≈ box-shadow 8 px. Добавлено на этапе 3 (D-25) |
| --shadow-accent-raised | -2px -2px 6px rgb(246 255 158 / .30), 2px 2px 6px rgb(174 187 31 / .30) | 7 | — |
| --shadow-accent-inset | inset 4px 4px 8px rgb(174 187 31 / .60), inset -4px -4px 8px rgb(246 255 158 / .95) | 3 | .60/.60 (1) |

## Состояния (D-02)
| Токен | Значение |
|---|---|
| --color-inverse-hover | #3f3f3b — наведение на тёмные кнопки (#3f3f3b из макета, неактивные сегменты); добавлено на этапе 3 |
| --color-inverse-well | #242320 — журнал прогона внутри тёмной карточки (06, 16197:1755): ближайший `inverse-hover` #3f3f3b заметно светлее; добавлено на экране 06 (D-103) |
| --focus-ring-width / --focus-ring-offset | 2px / 2px |
| --focus-ring-color | `--color-text`; внутри `.surface-inverse` — `--color-on-inverse` |
| --disabled-opacity | 0.4 |

## Проверка спорных значений
Скрипт `use_figma` по фреймам «экран · …» (26.09.2026): до трёх примеров на значение с путём из имён родителей.

| Значение | Всего / экранов | Что это | Решение |
|---|---|---|---|
| fill #e6e2da | 299 / 24 | статичные утопленные панели и плашки: «Уточнения и проверки» (06, content), счётчик «36 роботов» (07, head), плитка «Объект операции · Паллета» (11) | `--color-surface-sunken`; сюда же #e7e3db и #dad6cd |
| fill #e9e5de | 263 / 24 | поля и интерактивные плитки: карточка пользователя (06, sidebar), поле «Найти процесс» (07, filters › row · search), плитка оценки «24 · Класс совпадает» (11) | роль другая — отдельный `--color-surface-muted`, с sunken не слит |
| fill #e4f33d | 27 / 4 | лаймовые заливки на светлом фоне: блок «Три демонстрационных объекта» (05), плашка «подтверждено» (А6, А7) | не hover и не ошибка, а второй оттенок акцента — `--color-accent-surface` |
| fill #d9f24a | 13 / 8 | мелкие заливки на тёмном: точка навигации (09а, section-nav › nav), полоса прогресса (А1а, progress-fill), бейдж «✓» (А3) | `--color-accent`; текстом тот же цвет — `--color-on-inverse` |
| text #3f3f3b | 19 / 6 | подписи неактивных вкладок и сегментов: «Объём» (09а, nav), «Ссылка» / «Файл» (А7, А7б, segment · файл/ссылка) | слит в `--color-text-secondary` |
| fill #d9d9d9 | 81 / 20 | прямоугольники 19×44 и эллипсы 24×24 `merged › bridge` внутри тёмных фреймов (07, 09а, 11) — детали формы, а не заглушки изображений | не токен; в `surface-sunken` не переводится |
| DROP_SHADOW 22 8,8 #b9b3a7@0.30 без светлой пары | 25 / 24 | `sidebar` 240×768 у левого края экрана (06, 07, 11) | слита в `--shadow-raised-lg`: светлая половина уходит за край окна, визуально то же; `raised-lg-dark` не нужен |
| Unbounded Light 28/38 ls −1 % | 2 | заголовки карточек экрана 05 «Посмотреть демо», «Войти в рабочий кабинет» (15935:35, 15935:76) | `type-display-md`; сверено на экране 05 (вычисленный стиль 28/38, −0.28 px) |
| Unbounded Light 24/31 | 3 | то же | слит в `type-display-sm` (24/32) |
| Unbounded Regular 14/22 | 2 | то же; вероятно, логотип «RAV5» | не токен — отдельный компонент `Logo` |

