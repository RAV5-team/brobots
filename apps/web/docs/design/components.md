# Инвентарь компонентов

В Figma нет ни одного компонента: всё ниже — повторяющиеся фреймы, найденные по именам слоёв
в секции `dev`. «Эталон» — nodeId примера, по которому реализуется примитив.
Колонка «Код» заполняется при реализации (путь в `apps/web/src/components/ui` или `apps/web/src/components/shell`).

| Примитив | Копий в макете | Эталон (nodeId) | Замеченные варианты / размеры | Код |
|---|---|---|---|---|
| Sidebar (shell) | 24 (4 структуры) | 15935:207 (экран 06, канон D-01) | 240×768 | `apps/web/src/components/shell/Sidebar.tsx` (+ `NavLinkItem`, `UserMenu`, `AppShell`); витрина `/dev/ui/shell` |
| Button | ~100 | 15935:150 | secondary md 44 px 14/20, sm 44 px 13/18 (сверено на 06); icon 36×36 («открыть», «изменить»); 206×48; 300×44 | `apps/web/src/components/ui/Button.tsx` (`Button`, `ButtonLink`), `IconButton.tsx` (`IconButton`, `IconButtonAnchor` — ссылка на файл в новой вкладке, 17б; `IconButtonLink`; классы круга — `iconButtonStyles.ts`, круг внутри кнопки-строки окна 15а: 44 / 36 / 24, `variant` raised / ghost — «×» строки таблицы 15950:2106, `tone` danger — «→» к ошибке 15950:2172); `/dev/ui/button` |
| Field (label + input + hint/error) | 131 | 15935:935 | высоты 92 / 108 / 116; есть состояние ошибки («field · Площадь активной (ошибка)»); подпись капсом на экране 05 (15935:94) | `apps/web/src/components/ui/Field.tsx` (`labelVariant` default / overline; `badge` — плашка происхождения справа от подписи, 15935:964; `id` — чтобы перейти к полю из сводки ошибок, 14); `/dev/ui/field` |
| Input | 165 | 15935:938 | 44 px (основной), 38 px (компактный, в таблицах), 62 px (вход 05, 15935:95) | `apps/web/src/components/ui/Input.tsx` (lg 60, md 44, compact 38, formula, error, `attention` — лаймовая обводка «понадобится позже», 15950:2125); `/dev/ui/input` |
| Search | 8 | 15935:280 | 44 px | `apps/web/src/components/ui/Search.tsx`; `/dev/ui/search` |
| Segmented control | 6 | 15935:976 | 44 и 40 px | `apps/web/src/components/ui/Segmented.tsx` (Radix ToggleGroup); `/dev/ui/segmented` |
| Select / Option | 61 | 15935:846 | option 36 / 38 / 64 px (с описанием) | `apps/web/src/components/ui/Select.tsx` (Radix Select, field / filter, опции с описанием); `/dev/ui/select` |
| Checkbox | 54 | 15935:847 | 18×18 | `apps/web/src/components/ui/Checkbox.tsx` (Radix); `/dev/ui/checkbox` |
| Radio | 5 | 15950:1928 | 18×18 | `apps/web/src/components/ui/RadioGroup.tsx` (Radix); `/dev/ui/radio` |
| Toggle | 20 | 15966:7301 | on / off, 36×20 | `apps/web/src/components/ui/Toggle.tsx` (Radix Switch); `/dev/ui/toggle` |
| Chip | ~170 | 15935:9 | 24 и 32 px; чипы-характеристики («класс», «грузоподъёмность») | `apps/web/src/components/ui/Chip.tsx` (`Chip` xs/sm/md, 4 тона; `ChipToggle` с пояснением `description` — «Вилы · FMR, штабелёры», 15935:992); `/dev/ui/chip` |
| Pill · тип | 40 | 15966:6095 | 24 px | = Badge: `apps/web/src/components/ui/Badge.tsx`; `/dev/ui/badge` |
| Badge | 21 | 15935:967 | допущение / формула / норматив | `apps/web/src/components/ui/Badge.tsx` (допущение / формула / норматив / точное значение); `/dev/ui/badge` |
| Card | 3 (+ KPI-карточки без имени) | 15935:1255 | 300 px; лаймовая вдавленная панель (15935:37, 15935:78); утопленная плашка «Уточнения и проверки» (15935:138); панели дашборда 06 с `raised-md` (15935:147); вдавленные плитки «24 / 10 / 2» (15935:1469) | `apps/web/src/components/ui/Card.tsx` (`Card` panel/tile/accent/sunken/inset — вдавленная плитка показателя r12 `inset-md`, экран 11, 15935:1469; well — вдавленная панель r16 `inset-md` внутри карточки, экран 12, 15950:1686; `elevation` md/lg, отступ 8/16/20/28, `CardTitle`, `CardStat`, `KpiCard`); `/dev/ui/card` |
| ActionButton | 2 (экран 05) | 15935:68, 15935:101 | капсула на всю ширину 64 px, круг 48 со стрелкой справа: default (светлый круг), strong (тёмный круг, подпись 600) | `apps/web/src/components/ui/ActionButton.tsx` (`ActionButton`, D-28) |
| BackLink | 1 (экран 05) | 15935:19 | капсула 48 px, вдавленный круг 32 со стрелкой слева | `apps/web/src/components/ui/ActionButton.tsx` (`BackLink`, D-28) |
| MergedButton | ~20 экранов (`merged › bridge`: 07, 09а, 11) | 15935:283 | тёмная капсула h44 px20 14/20 600 + круг 44 с иконкой, слитые вогнутой перемычкой 19×44; `drop-shadow-popover`. Та же перемычка — у активного пункта меню со счётчиком (15935:816) | `apps/web/src/components/ui/MergedButton.tsx` (`MergedButtonLink`, `MergedButton` — кнопка, `block` на всю ширину, 09а «Сохранить процесс →», `Bridge` — общий с `NavLinkItem`); `/dev/ui/button` |
| Counter | 1 (экран 06) | 15935:144 | тёмная пилюля 24 px с лаймовым числом внутри кнопки («Открыть 8») | `apps/web/src/components/ui/Counter.tsx` |
| Logo | 1 (экран 05) | 15935:24 | два круга 36 с «R» и «5», перекрытие 6 | `apps/web/src/components/ui/Logo.tsx` |
| Modal | 6 | 15966:7646, 16036:573 | `md` 620 px, p28, gap16; `sm` 560 px, p32, gap20, футер pb24 — подтверждение 17в (D-43); `onCloseAutoFocus` — вернуть фокус, если открывашки нет | `apps/web/src/components/ui/Modal.tsx` (Radix Dialog); `/dev/ui/modal` |
| Section header | 28 | 15935:931 | 44 / 52 / 60 px | `apps/web/src/components/ui/SectionHeader.tsx`; `/dev/ui/section-header` |
| Table row / cell | 206 row, 34 cell | 15997:408 | строка 37 px | `apps/web/src/components/ui/Table.tsx` (`TableHeaderCell tone="label"` — подпись колонки без капса, 15935:1132); `/dev/ui/table` |
| Dropzone | 1 | 15966:6188 | | `apps/web/src/components/ui/Dropzone.tsx` (правила D-18); `/dev/ui/dropzone` |
| Progress | 2 | 16044:378, 15950:2163 | 6 px; заливка лаймовая или тёмная (готовность профиля 14) | `apps/web/src/components/ui/Progress.tsx` (`tone` accent / inverse); `/dev/ui/progress` |
| SectionNav | 4 формы (09а, 14, 16, А2) | 15935:914 | капсула 40 px, 5 пунктов flex-1 с точкой 8; активный — тёмный, подпись лаймом | `apps/web/src/components/ui/SectionNav.tsx` (якоря на секции, `aria-current`); `/dev/ui/section-nav` |
| FormSection | 3 формы (09а, 14, 16) | 15935:1008, 15950:1975 | выпуклая панель r28 p28 gap20 с заголовком секции; сетка полей 2 колонки 20 × 16 | `apps/web/src/components/ui/FormSection.tsx` (`FormSection` — цель якоря `SectionNav`, `FieldGrid`) |
| FormulaStats | 3 (09а ×2, 16) | 15935:1047 | вдавленная панель r16: 3 колонки «ПОДПИСЬ / значение 20/28 / = формула» | `apps/web/src/components/ui/FormulaStats.tsx`; `/dev/ui/formula-stats` |
| TextLink | ~10 («← Процессы», «← Локации», «← Каталог», «+ Добавить группу персонала») | 15935:906, 15950:2130 | 14 px SemiBold, иконка слева | `apps/web/src/components/ui/TextLink.tsx` (`TextLink` — ссылка, `TextButton` — то же действием); `/dev/ui/text-link` |
| StatusBanner | 1 (12а «status · локация создана»; та же плашка ожидается на А3 «робот добавлен») | 15950:2251 | 78 px: граница border-strong, r16, отступы 16 / 16 / 16 / 24; заголовок 14/20 600 `on-accent` с галочкой, подпись 12/16 `text-secondary`, действие справа (кнопка secondary) | `apps/web/src/components/ui/StatusBanner.tsx` (`role="status"`, имя — по заголовку); `/dev/ui/status-banner` |
| TabNav | экраны локации (сверено на 15 и 17) | 15950:2501 | выпуклая капсула r28 p4 gap4 (`raised-md`); пункты h36 px16 14/20 500; активный — тёмная пилюля с лаймовой подписью и `drop-shadow-popover`. Каждая вкладка — свой адрес (в отличие от `SectionNav` с якорями и `Segmented` со значением) | `apps/web/src/components/ui/TabNav.tsx` (`NavLink`, `aria-current="page"`, `end` для вкладки-префикса; `activeTo` — явная активная вкладка, у которой два адреса (15 и 17, D-40): пункты рисуются как `Link` с `aria-current`); `/dev/ui/tab-nav` |

Все интерактивные примитивы дополнительно получают hover / focus-visible / disabled по D-02.

Сверх инвентаря (D-07): `apps/web/src/components/ui/States.tsx` — `EmptyState` (`size`: `md` — вдавленная плашка «ничего не найдено»; `lg` — выпуклая панель r28 64/88 на месте пустого раздела, 15919:552, D-40), `ErrorState`, `Skeleton`; витрина `/dev/ui/states`.
Состояния на витринах показываются атрибутом `data-demo-state` (hover / active / focus) — варианты Tailwind в `apps/web/src/styles/states.css` срабатывают и на него; в экранах атрибут не используется.
