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
│   ├── simulation/              Python — прогон рабочего дня (SimPy)
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── api/             маршруты FastAPI
│   │   │   ├── core/            настройки, инфраструктура
│   │   │   └── domain/          модель симуляции
│   │   └── tests/
│   │
│   └── economics/               Python — CAPEX, OPEX, эффект, окупаемость
│       └── (структура та же, что у simulation)
│
├── packages/                    общий код и контракты
│   ├── pycommon/                общий слой Python-сервисов
│   │   └── pycommon/            конфиг, логи, конверт ответа, health
│   └── contracts/               контракт между сервисами — один источник правды
│       ├── openapi/
│       └── schemas/
│
├── infra/
│   └── postgres/init/           SQL, выполняется при создании пустой базы
│
├── docs/                        проектная документация
├── scripts/                     вспомогательные скрипты
│
├── docker-compose.yml           базовый контур
├── docker-compose.override.yml  разработка: монтирование кода, автоперезапуск
├── docker-compose.prod.yml      прод: без внешних портов, лимиты ресурсов
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

```bash
cp .env.example .env     # или make init
docker compose up --build
```

| Сервис     | Стек                 | Порт (dev) | Роль                                  |
|------------|----------------------|------------|---------------------------------------|
| web        | Vite + React + TS    | 5173       | интерфейс                             |
| api        | Go                   | 8000       | шлюз, хранение расчётов               |
| simulation | Python + FastAPI     | 8001       | прогон рабочего дня                   |
| economics  | Python + FastAPI     | 8002       | экономика конфигурации                |
| postgres   | PostgreSQL 16        | 5432       | хранилище                             |

Прод: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
Наружу торчит только фронтенд (`WEB_PUBLIC_PORT`, по умолчанию 8080), остальное
доступно внутри сети compose. `make help` — список остальных команд.

## Что дальше

Каркас соберётся в образы только после того, как в директориях появится код.
Минимум, которого не хватает:

1. **`apps/web`** — отсутствует `package.json`. Скаффолдинг:
   `npm create vite@latest apps/web -- --template react-ts`, затем
   `npm install` (нужен закоммиченный `package-lock.json` — его ждёт `npm ci`)
   и прокси `/api` → `http://api:8000` в `server.proxy` внутри `vite.config.ts`.
2. **`services/api`** — `cmd/api/main.go` и пакеты в `internal/`.
3. **`services/simulation`, `services/economics`** — `app/main.py`, который
   поднимает приложение FastAPI (Dockerfile запускает `app.main:app`).
4. **`packages/pycommon/pycommon`** — общий слой; в образ попадает через
   `PYTHONPATH=/opt/pycommon`, отдельная сборка пакета не нужна.
5. **`infra/postgres/init`** — стартовая схема. Выполняется **один раз**, при
   создании пустого тома; после изменения нужен `make clean`.

Каждый Dockerfile содержит стадию `test` (`docker build --target test ...`) —
`make test` прогоняет её для всех трёх сервисов.
