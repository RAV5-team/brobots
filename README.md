# brobots — монорепозиторий

Три бэкенд-сервиса, фронтенд и Postgres. Контейнеризация — Dockerfile на каждый
сервис плюс docker compose на весь контур.

Сейчас в репозитории **только каркас**: директории, Dockerfile'ы, compose и
конфигурация окружения. Кода сервисов ещё нет — см. «Что дальше».

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
│   └── economics/               Python — CAPEX, OPEX, эффект, окупаемость (каркас)
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
│   └── postgres/init/           роли и БД keycloak, api, simulation — при создании пустого тома
│
├── docs/
│   ├── keycloak.md              Keycloak: запуск, realm, адреса, проверка
│   └── middleware.md            проверка токенов Keycloak в сервисах (Go, Python)
├── scripts/                     секреты и smoke-тесты Keycloak
│
├── docker-compose.yml           Postgres + Keycloak + шлюз + api + simulation, профиль local
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

Поднимаются Postgres, Keycloak, nginx-шлюз, api и simulation:

| Что | Адрес |
|-----|-------|
| Keycloak | http://localhost/auth/ |
| api (Swagger — `/docs`) | http://localhost:8000 |
| simulation (экран шага, API — `/api/...`) | http://localhost:8765 |

Схему БД simulation применяет разовый контейнер `simulation-migrate` (`alembic upgrade head`),
api мигрирует себя сам при старте. economics и web пока каркасы и в compose не входят.
Первый старт — **1–2 минуты**: Keycloak создаёт схему в своей БД и импортирует realm.
Дождитесь `healthy` в `docker compose ps`.

| Кто | Логин | Пароль | Где |
|-----|-------|--------|-----|
| Пользователь | `user@example.com` | `DemoUser2026` | realm `rav5` |
| Администратор платформы | `admin@example.com` | `DemoAdmin2026` | realm `rav5` |
| Администратор Keycloak | `kcadmin` | `rav5-local-kcadmin-5b8e36` | http://localhost/auth/admin/ |

- Сброс (БД, realm, ключи подписи): `docker compose down -v`. Нужен и после правки
  `infra/keycloak/realm-rav5.json`, смены `PUBLIC_URL` или паролей в `.env`.
- Порт 80 занят: `GATEWAY_PORT=8080` и `PUBLIC_URL=http://localhost:8080`, затем `down -v`.
- HTTPS-стенд: `./scripts/gen-secrets.sh`, сертификат в `infra/nginx/certs/`,
  `docker compose -f docker-compose.yml -f docker-compose.stand.yml up -d --build`.
- Проверка: `./scripts/auth-smoke.sh`. Подробности — [docs/keycloak.md](docs/keycloak.md),
  проверка токенов в сервисах — [docs/middleware.md](docs/middleware.md),
  команды — `make help`.

## Что дальше

Каркас соберётся в образы только после того, как в директориях появится код.
Минимум, которого не хватает:

1. **`apps/web`** — отсутствует `package.json`. Скаффолдинг:
   `npm create vite@latest apps/web -- --template react-ts`, затем
   `npm install` (нужен закоммиченный `package-lock.json` — его ждёт `npm ci`)
   и прокси `/api` → `http://api:8000` в `server.proxy` внутри `vite.config.ts`.
2. ~~**`services/api`**~~ — готов: локации, задачи, проекты, каталог, классы
   операций и подбор. Запуск, контракт и карта экранов — [docs/api](docs/api/README.md).
3. ~~**`services/simulation`**~~ — готов, см. [services/simulation/README.md](services/simulation/README.md).
   **`services/economics`** — `app/main.py`, который поднимает приложение FastAPI
   (Dockerfile запускает `app.main:app`).
4. **`packages/pycommon/pycommon`** — общий слой; в образ попадает через
   `PYTHONPATH=/opt/pycommon`, отдельная сборка пакета не нужна.
5. **`infra/postgres/init`** — скрипты создания ролей и БД. Выполняются **один раз**,
   при создании пустого тома; после изменения нужен `make clean`.

Каждый Dockerfile содержит стадию `test` (`docker build --target test ...`) —
`make test` прогоняет её для всех трёх сервисов.
