# Сервис api: локации, каталог, подбор

Go-сервис `services/api` закрывает три логических блока архитектуры RAV5:

- **Location, task, and project service** — локации с параметрами типа объекта, задачи (процесс на локации), проекты ровно с одной задачей, снимок входных данных и закреплённые версии.
- **Catalog and work-type service** — классы операций OP-01…OP-10, каталог роботов и позиций для запуска, ТТХ, строки «робот × класс», предложения с ценой, источники данных, справочник процессов.
- **Work-type matching and hard checks** — кандидаты по совпадению класса операции и жёсткие проверки со значениями, источниками и причинами.

Авторизации и оркестрации пока нет. Экономику, скоринг и симуляцию считают соседние сервисы; этот сервис отдаёт им контекст оценки (`GET /api/v1/projects/{id}/evaluation-context`).

Документы рядом:

- [plan-location-catalog-matching.md](plan-location-catalog-matching.md) — план и отступления от него;
- [db-schema.md](db-schema.md) — таблицы и колонки;
- [matching-rules.md](matching-rules.md) — алгоритм подбора (ТЗ 6.4);
- [seed-data.md](seed-data.md) — демо-данные, их источники и допущения.

Контракт: [`packages/contracts/openapi/api.yaml`](../../packages/contracts/openapi/api.yaml), Swagger UI — `http://localhost:8000/docs`.

## Запуск

Весь контур:

```bash
cp .env.example .env
docker compose up --build
```

Только api и Postgres, без остальных сервисов:

```bash
docker compose up -d postgres
docker build -f services/api/Dockerfile --target runtime -t brobots-api .
docker run --rm -p 8000:8000 --network brobots_brobots \
  -e DATABASE_URL="postgres://brobots:change_me_locally@postgres:5432/brobots?sslmode=disable" \
  -e SEED_DEMO=true brobots-api
```

Локально без Docker (нужен Go 1.26 и Postgres):

```bash
cd services/api
export DATABASE_URL="postgres://brobots:change_me_locally@localhost:5432/brobots?sslmode=disable"
go run ./cmd/api seed   # миграции + демо-данные, затем выход
go run ./cmd/api        # сервер на :8000
```

Команды бинаря: `api` (сервер), `api migrate`, `api seed`.

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DATABASE_URL` | — | Строка подключения к Postgres, обязательна |
| `HTTP_ADDR` | `:8000` | Адрес сервера |
| `MIGRATE_ON_START` | `true` | Применять миграции goose при старте |
| `SEED_DEMO` | `false` (в compose `true`) | Загрузить демо-данные; существующие записи не перезаписываются |
| `SWAGGER_ENABLED` | `true` | Swagger UI на `/docs` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Тесты и контракт

```bash
cd services/api
go test ./...                                  # модульные и контрактные тесты
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable" \
  go test -tags=integration ./internal/integration/   # на живом Postgres, создаёт и удаляет свою БД
go generate ./...                              # пересобрать OpenAPI после изменения API
docker build -f services/api/Dockerfile --target test .   # из корня репозитория
```

- `internal/matching` — табличные тесты каждой жёсткой проверки, итогового состояния, рисков и сортировки.
- `internal/domain`, `internal/formula`, `internal/service`, `internal/seed` — форматирование, валидация параметров, производные задачи, готовность, формулы, merge patch, разбор CSV каталога.
- `tools/openapi` — маршруты роутера совпадают с операциями контракта, сгенерированный файл актуален, спецификация валидна.
- `internal/integration` — миграции вверх и вниз, повторный seed ничего не меняет, эталонный подбор РЦ Химки, сквозной сценарий «локация → задача → проект → подбор → условия → ручной кандидат → снимок», админка каталога.

CI — [`.github/workflows/api.yml`](../../.github/workflows/api.yml): gofmt, go vet, golangci-lint, проверка актуальности контракта, unit с `-race`, integration с Postgres 16, сборка стадий `test` и `runtime`, публикация образа в GHCR при пуше в `main`.

## Устройство

```text
services/api/
  cmd/api/                 main: serve | migrate | seed
  migrations/              0001_reference … 0005_project_matching (goose, встроены в бинарь)
  internal/config/         переменные окружения
  internal/domain/         сущности, валидация, производные задачи, готовность, полнота ТТХ
  internal/formula/        формулы процессов (expr) по параметрам локации
  internal/matching/       условия задачи и жёсткие проверки, без БД
  internal/store/          репозитории на pgx
  internal/service/        сценарии: задача из процесса, снимок проекта, прогон подбора
  internal/handlers/       chi-роутер, JSON, ошибки RFC 7807
  internal/seed/           загрузчик и данные: каталог ФЦ БАС, датасеты, процессы, демо-локации
  internal/apispec/        встроенная копия OpenAPI
  tools/openapi/           генератор контракта из Go-типов
```

Соглашения API:

- JSON в camelCase, идентификаторы — UUID, коды — `OP-01`, `RB-0224`, `PR-0001`.
- Доли (`automationShare`, `timeShare`, `sitePrepShare`) — от 0 до 1; деньги — рубли с НДС числом.
- Списки — `{items, total}` с `limit` и `offset`, либо `{items}` для коротких справочников.
- Ошибки — `application/problem+json`: `errors[]` с полем, кодом, сообщением и подсказкой на русском. 400 — неверный идентификатор или параметр, 404 — не найдено, 409 — конфликт (дубль, задача уже на локации, класс занятого процесса), 422 — ошибка в данных.
- PATCH — JSON merge patch; `DELETE` каталожных сущностей скрывает их (`isActive=false`), задачи архивирует, локации и проекты удаляет мягко.

## Экраны Figma и эндпоинты

Раздел «dev» макета (ряды A, B, C) и экраны проекта из реестра PRD.

| Экран | Эндпоинты |
|---|---|
| A1 каталог, A3 робот добавлен | `GET /solutions?kind=robot&includeHidden=true` |
| A2 новый робот | `GET /dictionaries`, `GET /work-types`, `POST /solutions` (с `workTypeIds` и `spec`) |
| A6, A7, A7б источники | `GET/POST/PATCH/DELETE /data-sources` |
| A8, A9 классы операций | `GET /work-types`, `POST /work-types` |
| 06 дашборд | `GET /dashboard/summary` |
| 07 процессы | `GET /processes`, фильтры `workTypeId`, `facilityType` |
| 09а новый процесс | `POST /processes` |
| 11 процесс | `GET /processes/{id}`, `GET /processes/{id}/robots` |
| 12, 12а локации | `GET /locations` |
| 13, typical | `GET /locations/templates`, `POST /locations/from-template` |
| 14 новая локация | `GET /facility-types/{code}/parameters`, `POST /locations` |
| 15, 15а, 17 задачи локации | `GET /locations/{id}`, `GET /locations/{id}/tasks`, `POST /locations/{id}/tasks` |
| 16 задача | `GET /tasks/{id}`, `PATCH /tasks/{id}` (`assumeDefaults` — кнопка «Не знаю») |
| 17а параметры объекта | `GET/PUT /locations/{id}/parameters`, `PUT /locations/{id}/staff-groups` |
| 17в удалить задачу | `DELETE /tasks/{id}` |
| 18 подходящие роботы | `GET /tasks/{id}/match-preview` |
| projects, np, npnew, nptyp, rowmenu, delete | `GET/POST/PATCH/DELETE /projects`, `POST /projects/{id}/copy` |
| saved, versions | `GET /projects/{id}` (`dataChanged`, `catalogUpdated`, `versions`), `POST /projects/{id}/refresh-snapshot` |
| params, conds (12a) | `GET/PUT/DELETE /projects/{id}/conditions` |
| podbor (12) | `POST /projects/{id}/matching-runs`, `GET …/matching-runs/latest`, `POST/DELETE …/manual-candidates`, `PUT …/selection` |
| e7, e8 | `POST /locations/{id}/tasks`, затем `POST /projects` |
| catalog, catfilt, catdrop, catind, catready, catcost, catsort | `GET /solutions` (фильтры и `sort`) |
| solution, compare | `GET /solutions/{id}`, `GET /solutions/compare?ids=` |

Вне рамок сервиса: A1а (обновление каталога по запросу), A5 (нормативы), 17б (документы), загрузка Excel и фото, sim*, econ*, calc, weights, result, report, kp, integr. Балл, CAPEX, число роботов и окупаемость на экране «Подбор» добавит оркестратор поверх `matching-runs`.

## Открытые вопросы к команде

1. **Единица у класса операции.** OP-01 объединяет паллеты и багаж, а в A9 у класса одна единица. Сейчас единица объёма задаётся у процесса (`kpiUnit`), производительность строки «робот × класс» — в единице этого процесса. Economics должен это учитывать.
2. **Метки переноса P0–P2** требуют таблицы «отрасль ↔ тип объекта». Пока считается только P3 (статус `rnd` или УГТ ниже 7).
3. **Фильтр каталога «Тип объекта»** выводится через процессы, применимые к типу, и их классы.
4. **Робот без цены** исключается проверкой `price`, остальные проверки видны — можно показывать «технически подходит, нет цены» (пример — PuduBot 2).
5. **Производительность-диапазон**: в расчёт идёт нижняя граница, исходный диапазон хранится в `throughputRangeText`.
6. **Кнопки без бэкенда**: «Загрузить из Excel», «Скачать шаблон», «Обновить каталог», A5, 17б, загрузка фото — скрыть или назначить владельца.
7. **Таблицы результатов расчёта** (`configuration_result`, `simulation_run`) в общей базе api — кто их создаёт и владеет ими.
8. **Демо-цифры макетов расходятся с датасетом**: у упаковки на РЦ Химки нет оклада (готовность 8/9), площадь Даркстора Юг 8 400 м² ниже минимума датасета (взято 10 500 м²), у робота AMR 800 в карточке 2 м/с, в расчётах модели 1,5 м/с.
