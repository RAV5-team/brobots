# brobots — монорепозиторий

RAV5 — подбор и оценка роботизации процессов на площадке: фронтенд, три
бэкенд-сервиса, Keycloak и Postgres. Каждый сервис — свой Dockerfile, весь
контур — Docker Compose.

- **api** (Go) — оркестратор: локации, задачи, проекты, каталог, подбор.
  Экономику считает через economics, прогоны рабочего дня ставит в simulation.
- **simulation** (Python, SimPy) — прогон рабочего дня.
- **economics** (Python) — CAPEX, OPEX, эффект, окупаемость, ranking-v1.
  Только внутренняя сеть, принимает лишь сервисный токен api.
- **web** (Vite + React + TypeScript) — интерфейс; работает на моках или на api.
- **Keycloak** — вход и роли, тема входа собрана из `apps/keycloak-theme`.

## Структура

```text
brobots/
├── apps/
│   ├── web/                     фронтенд: Vite + React 19 + TypeScript + Tailwind 4
│   │   ├── Dockerfile           multi-stage: node → проверки/сборка → nginx
│   │   ├── nginx.conf           раздача статики + прокси /api → api
│   │   ├── AGENTS.md            правила фронтенда: токены, Figma, definition of done
│   │   ├── docs/                PRD, дизайн-решения, контракт с api, аудиты
│   │   ├── e2e/                 Playwright: маршруты, axe, визуальные эталоны
│   │   └── src/
│   │       ├── api/             HTTP-клиент, сгенерированные типы, мапперы
│   │       ├── services/        данные экранов: api/ и mock/ за одним интерфейсом
│   │       ├── mocks/           фикстуры для режима моков
│   │       ├── components/      ui/ — примитивы, shell/ — каркас приложения
│   │       ├── pages/           экраны
│   │       ├── domain/          типы предметной области
│   │       ├── shared/          конфиг, авторизация (keycloak-js)
│   │       └── styles/          токены и типографика
│   └── keycloak-theme/          тема входа Keycloak (keycloakify), собирается в образ Keycloak
│
├── services/
│   ├── api/                     Go — оркестратор, единая точка входа, Postgres
│   │   ├── cmd/api/             точка входа
│   │   ├── internal/
│   │   │   ├── handlers/        HTTP-обработчики и роутер
│   │   │   ├── service/         сценарии: проекты, оценка, симуляция
│   │   │   ├── matching/        подбор решений
│   │   │   ├── calc/            порт калькуляции: economics или мок-модель
│   │   │   ├── formula/         формулы процессов над параметрами локации
│   │   │   ├── clients/         клиенты к simulation и economics
│   │   │   ├── auth/            проверка токенов Keycloak
│   │   │   ├── store/           репозитории поверх Postgres
│   │   │   ├── seed/            демо-данные организатора
│   │   │   └── config/, domain/, apispec/, integration/
│   │   └── migrations/          SQL-миграции (goose)
│   │
│   ├── simulation/              Python — прогон рабочего дня (SimPy), см. его README
│   │   ├── simcore/             модель симуляции
│   │   ├── application/         сценарии: задание, прогон, предпросмотр
│   │   ├── adapters/            Postgres, HTTP, воркер, дочерние процессы
│   │   ├── app/                 настройки и точки входа (server, worker)
│   │   └── migrations/          Alembic
│   │
│   └── economics/               Python — экономическая модель, см. его README
│
├── packages/
│   ├── pycommon/                общий слой Python-сервисов: конфиг, логи, конверт ответа, health
│   └── contracts/openapi/       контракты api.yaml и economics.yaml — один источник правды
│
├── infra/
│   ├── keycloak/                образ Keycloak с темой и realm rav5 (роли, клиенты, демо-учётки)
│   ├── nginx/                   шлюз: профили local, stand и coi (Yandex Cloud)
│   ├── postgres/                роли и БД keycloak, api, simulation, economics — при создании тома
│   └── deploy/                  продление сертификатов certbot на ВМ
│
├── docs/                        документация контура, карта — в разделе «Документация»
│
├── scripts/                     генерация секретов, smoke-тесты Keycloak, выгрузка датасетов в seed api
├── .github/workflows/           CI сервисов, сборка образов, деплой
│
├── docker-compose.yml           локальный контур: Postgres, Keycloak, шлюз, api, simulation, economics
├── docker-compose.stand.yml     оверлей stand: TLS, HSTS, web за шлюзом, закрытые порты сервисов
├── docker-compose.coi.yml       спецификация для ВМ Yandex Cloud (образы из GHCR)
└── Makefile                     make help — список команд
```

## Почему так

**`services/` отдельно от `apps/`.** Бэкенд-сервисы деплоятся независимо,
фронтенд — статика. Разные жизненные циклы, разные Dockerfile'ы.

**`internal/` в Go-сервисе.** Компилятор запрещает импортировать `internal/`
снаружи модуля: границу сервиса держит не договорённость, а сборка.

**`packages/pycommon`.** Формат ответа, формат логов и health-эндпоинты обязаны
совпадать во всех сервисах. Скопированный дважды код разъезжается на второй день.

**`packages/contracts`.** Схемы запросов и ответов лежат отдельно от сервисов,
иначе контракт начинает жить в голове того, кто писал бэкенд. Типы фронта
генерируются из них (`npm run gen:api`).

**Контекст сборки — корень репозитория.** Поэтому в Dockerfile'ах пути вида
`services/api/...`: иначе общий `packages/pycommon` не попадёт в образ.

## Запуск бэкенда

Требования: Docker с Docker Compose **2.24+**, свободный порт 80.

```bash
make up        # = cp .env.example .env (если нет) + docker compose up -d --build
```

| Что | Адрес |
|-----|-------|
| Keycloak | http://localhost/auth/ |
| api (Swagger — `/docs`) | http://localhost:8000 |
| simulation (экран шага, API — `/api/...`) | http://localhost:8765 |
| economics | только Docker internal, `http://economics:8002` |

Первый старт — **1–2 минуты**: Keycloak создаёт схему и импортирует realm.
Дождитесь `healthy` в `docker compose ps`.

- Схемы БД применяют разовые контейнеры `simulation-migrate` и
  `economics-migrate`; api мигрирует себя сам и один раз загружает демо-данные
  (`API_SEED_DEMO`).
- api ждёт готовности economics: сид сразу считает демо-проекты.
  `ECONOMICS_URL=` (пусто) переключает api на мок-модель экономики.
- Ручная проверка без токена: `AUTH_DEV_MODE=true` в `.env` — запросы идут от
  `AUTH_DEV_SUB` с ролями `AUTH_DEV_ROLES`. Работает только при `APP_ENV=local`.

| Кто | Логин | Пароль | Где |
|-----|-------|--------|-----|
| Пользователь | `demo@rav5.ru` | `DemoUser2026` | realm `rav5` |
| Администратор платформы | `admin@rav5.ru` | `DemoAdmin2026` | realm `rav5` |
| Администратор Keycloak | `kcadmin` | `rav5-local-kcadmin-5b8e36` | http://localhost/auth/admin/ |

- Сброс (БД, realm, ключи подписи): `make clean`. Нужен и после правки
  `infra/keycloak/realm-rav5.json`, смены `PUBLIC_URL` или паролей в `.env`.
- Порт 80 занят: `GATEWAY_PORT=8080` и `PUBLIC_URL=http://localhost:8080`, затем `make clean`.
- Проверка: `make smoke`. Подробности — [docs/keycloak/keycloak.md](docs/keycloak/keycloak.md),
  проверка токенов — [docs/keycloak/middleware.md](docs/keycloak/middleware.md),
  api — [docs/api/README.md](docs/api/README.md).

## Запуск фронтенда

Локальный контур фронт не собирает — он работает через Vite dev-сервер
(Node 22+):

```bash
cd apps/web
npm ci
npm run dev    # http://localhost:5173, /api проксируется на http://localhost:8000
```

Источник данных выбирается при сборке:

| Переменная | Значение |
|-----|-------|
| `VITE_SERVICES` | `api` — живой api; иначе моки на фикстурах |
| `VITE_OIDC_URL` | `http://localhost/auth/realms/rav5` — вход через Keycloak; пусто — без входа, роль через `?as=guest\|user\|admin` |
| `VITE_OIDC_CLIENT_ID` | `rav5-web` |
| `API_PROXY_TARGET` | куда dev-сервер проксирует `/api`, если не `localhost:8000` |

Проверки: `npm run lint`, `npm run typecheck`, `npm test` (покрытие —
`test:coverage`, порог 80%), `npm run test:e2e`, `npm run test:visual`
(эталоны снимаются в Docker), `npm run check:bundle` (бюджет JS первой загрузки).
Правила работы с экранами — [apps/web/AGENTS.md](apps/web/AGENTS.md).

## Стенд и деплой

- **HTTPS-стенд на своей машине:** `make secrets`, `PUBLIC_URL`/`PUBLIC_HOST` в
  `.env`, сертификат в `infra/nginx/certs/`, затем `make up-stand`. Оверлей
  собирает web с `VITE_SERVICES=api`, ставит его за шлюз и закрывает порты api
  и simulation.
- **Yandex Cloud:** `release-images.yml` на каждый push в `main` публикует
  образы в GHCR, `deploy.yml` (запуск вручную) обновляет ВМ по
  `docker-compose.coi.yml`. Runbook — [docs/deployment/yandex-cloud.md](docs/deployment/yandex-cloud.md).
- **CI:** `api.yml`, `economics.yml`, `keycloak-theme.yml` — линт, тесты и
  интеграционные тесты с Postgres по изменённым путям.

## Документация

| Документ | О чём |
|---|---|
| [docs/RAV5_PRD.docx](docs/RAV5_PRD.docx) | требования к продукту; markdown-копия — `apps/web/docs/product/prd/` |
| [docs/orchestrator.md](docs/orchestrator.md) | жизненный цикл проекта, снимки данных, калькуляция и симуляция |
| [docs/api/](docs/api/README.md) | сервис api: запуск, доступ, эндпоинты, [схема БД](docs/api/db-schema.md), [правила подбора](docs/api/matching-rules.md), [демо-данные](docs/api/seed-data.md) |
| [docs/keycloak/](docs/keycloak/keycloak.md) | Keycloak: запуск, роли, учётки; [проверка токенов в сервисах](docs/keycloak/middleware.md) |
| [docs/economics/](docs/economics/integration-report.md) | интеграция economics с api и [бэклог валидации](docs/economics/backlog.md) |
| [docs/decisions/ranking-methodology-signoff.md](docs/decisions/ranking-methodology-signoff.md) | утверждённый контракт рейтинга `ranking-v1` |
| [docs/guides/currency-and-extracted-data.md](docs/guides/currency-and-extracted-data.md) | валюта расчёта и граница извлечённых данных |
| [docs/reference/economics/](docs/reference/economics/economic_inputs.md) | словарь входов экономической модели по книге Excel |
| [docs/source-materials/economics/](docs/source-materials/economics/) | исходные книга, методика и аудит экономической модели |
| [docs/deployment/yandex-cloud.md](docs/deployment/yandex-cloud.md) | развёртывание в Yandex Cloud |

Документы сервисов лежат рядом с кодом: [services/simulation/README.md](services/simulation/README.md),
[services/economics/README.md](services/economics/README.md), [apps/web/docs/](apps/web/docs/).

## Что дальше

Открытые вопросы и доработки интеграции фронта и бэка с приоритетами —
[docs/integration-followups.md](docs/integration-followups.md). Блокеры
релиза economics — [docs/economics/backlog.md](docs/economics/backlog.md).
