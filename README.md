# brobots — монорепозиторий

Три бэкенд-сервиса, фронтенд и Postgres. Контейнеризация — Dockerfile на каждый
сервис плюс Docker Compose на весь контур.

Go API, simulation и internal-only economics service входят в Compose-контур.
Оркестратор вызывает economics при расчёте проекта; создание или редактирование
проекта само по себе расчёт не запускает. У economics отдельная база PostgreSQL.

## Структура

```text
brobots/
├── apps/
│   └── web/                     фронтенд: Vite + React + TypeScript
│       ├── Dockerfile           multi-stage: node → сборка → nginx
│       ├── nginx.conf           раздача статики + прокси /api → api
│       ├── public/
│       └── src/
│           ├── api/             HTTP-клиент, типы ответов сервисов
│           ├── components/      переиспользуемые компоненты
│           ├── pages/           экраны
│           └── styles/          токены и глобальные стили
│
├── services/
│   ├── api/                     Go — шлюз: единая точка входа, работа с Postgres
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── cmd/api/             main.go, точка входа
│   │   ├── internal/
│   │   │   ├── config/          чтение переменных окружения
│   │   │   ├── handlers/        HTTP-обработчики и роутер
│   │   │   ├── clients/         клиенты к simulation и economics
│   │   │   └── store/           репозитории поверх Postgres
│   │   └── migrations/          SQL-миграции схемы
│   │
│   ├── simulation/              Python — прогон рабочего дня (SimPy), см. его README
│   │   ├── Dockerfile           один образ: сервер, воркер, миграции
│   │   ├── simcore/             модель симуляции
│   │   ├── application/         сценарии: задание, прогон, предпросмотр
│   │   ├── adapters/            Postgres, HTTP, воркер, дочерние процессы
│   │   ├── app/                 настройки и точки входа (server, worker)
│   │   ├── migrations/          Alembic
│   │   └── tests/
│   │
│   └── economics/               Python — CAPEX, OPEX, effect, payback, ranking-v1
│
├── packages/                    общий код и контракты
│   ├── pycommon/                общий слой Python-сервисов
│   │   └── pycommon/            конфиг, логи, конверт ответа, health
│   └── contracts/               контракт между сервисами — один источник правды
│       ├── openapi/
│       └── schemas/
│
├── infra/
│   ├── keycloak/                образ Keycloak и realm rav5 (роли, клиенты, демо-учётки)
│   ├── nginx/                   шлюз к Keycloak на /auth: профили local и stand
│   └── postgres/init/           роли и БД keycloak, api, simulation, economics — при создании пустого тома
│
├── docs/
│   ├── RAV5_PRD.docx            требования к продукту
│   ├── api/                     сервис api: контракт, схема БД, подбор
│   └── keycloak/
│       ├── keycloak.md          Keycloak: запуск, realm, адреса, проверка
│       └── middleware.md        проверка токенов Keycloak в сервисах (Go, Python)
│   ├── economics/               методика, currency boundary и backlog economics
├── scripts/                     секреты и smoke-тесты Keycloak
│
├── docker-compose.yml           Postgres + Keycloak + шлюз + api + simulation + economics
├── docker-compose.stand.yml     оверлей профиля stand: TLS, HSTS, allowlist админки
├── Makefile
├── .env.example
├── .dockerignore
└── .gitignore
```

## Почему так

**`services/` отдельно от `apps/`.** Бэкенд-сервисы деплоятся независимо,
фронтенд — статика. Разные жизненные циклы, разные Dockerfile'ы.

**`internal/` в Go-сервисе.** Компилятор запрещает импортировать `internal/`
снаружи модуля: границу сервиса держит не договорённость, а сборка.

**`packages/pycommon`.** Формат ответа, формат логов и health-эндпоинты обязаны
совпадать во всех сервисах. Скопированный дважды код разъезжается на второй день.

**`packages/contracts`.** Схемы запросов и ответов лежат отдельно от обоих
сервисов, иначе контракт начинает жить в голове того, кто писал бэкенд.

**Контекст сборки — корень репозитория.** Поэтому в Dockerfile'ах пути вида
`services/api/...`: иначе общий `packages/pycommon` не попадёт в образ.

## Запуск

Требования: Docker с Docker Compose **2.24+**, свободный порт 80.

```bash
cp .env.example .env
docker compose up -d --build
```

Поднимаются Postgres, Keycloak, nginx-шлюз, api, simulation и economics:

| Что | Адрес |
|-----|-------|
| Keycloak | http://localhost/auth/ |
| api (Swagger — `/docs`) | http://localhost:8000 |
| simulation (экран шага, API — `/api/...`) | http://localhost:8765 |
| economics | только Docker internal, `http://economics:8002` |

Схемы БД применяют разовые контейнеры `simulation-migrate` и
`economics-migrate` (`alembic upgrade head`); api мигрирует себя сам при
старте. Economics не публикует порт на хост, не подключён к nginx gateway и
принимает только сервисный токен api (клиент `rav5-api-internal`).
Первый старт — **1–2 минуты**: Keycloak создаёт схему в своей БД и импортирует realm.
Дождитесь `healthy` в `docker compose ps`.

| Кто | Логин | Пароль | Где |
|-----|-------|--------|-----|
| Пользователь | `demo@rav5.ru` | `DemoUser2026` | realm `rav5` |
| Администратор платформы | `admin@rav5.ru` | `DemoAdmin2026` | realm `rav5` |
| Администратор Keycloak | `kcadmin` | `rav5-local-kcadmin-5b8e36` | http://localhost/auth/admin/ |

- Сброс (БД, realm, ключи подписи): `docker compose down -v`. Нужен и после правки
  `infra/keycloak/realm-rav5.json`, смены `PUBLIC_URL` или паролей в `.env`.
- Порт 80 занят: `GATEWAY_PORT=8080` и `PUBLIC_URL=http://localhost:8080`, затем `down -v`.
- HTTPS-стенд: `./scripts/gen-secrets.sh`, сертификат в `infra/nginx/certs/`,
  `docker compose -f docker-compose.yml -f docker-compose.stand.yml up -d --build`.
- Проверка: `./scripts/auth-smoke.sh`. Подробности — [docs/keycloak/keycloak.md](docs/keycloak/keycloak.md),
  проверка токенов в сервисах — [docs/keycloak/middleware.md](docs/keycloak/middleware.md),
  команды — `make help`.

## Текущий статус

- **`apps/web`** — Vite, React и TypeScript приложение с API-режимом
  (`VITE_SERVICES=api`). Методы без поддержки на API сообщают о недостающем
  вызове вместо подстановки фиктивных данных.
- **`services/api`** — локации, задачи, проекты, каталог, подбор и вызовы
  economics. Запуск и контракт описаны в [документации API](docs/api/README.md).
- **`services/simulation`** — сервис прогонов и воркеров; см.
  [README сервиса симуляции](services/simulation/README.md).
- **`services/economics`** — внутренний сервис расчётов в Compose. Текущие
  ограничения исторической интеграции записаны в
  [снимке от 28.09.2026](docs/integration-followups.md); это не текущий список
  задач.

CI for economics runs lint, unit/API, and PostgreSQL integration tests on
Python 3.12, then builds test and runtime container stages. PostgreSQL tests
require `POSTGRES_TEST_DATABASE_URL`; CI sets it and fails if it is missing.
The release blockers are recorded in
[the economics backlog](docs/economics/backlog.md).
