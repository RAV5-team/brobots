# Интеграция фронта и бэкенда: что доделать и открытые вопросы

Состояние на 28.09.2026, ветка `feat/web-api-integration` (9 коммитов, не отправлена в origin).
Что сделано — [apps/web/docs/api-contract.md](../apps/web/docs/api-contract.md) («Как закрыты вопросы»),
[orchestrator.md](orchestrator.md) (параметры расчёта, симуляция), [api/README.md](api/README.md).

Приоритеты: **P0** — мешает сквозному сценарию демо, **P1** — нужно до сдачи, **P2** — желательно.

## 1. Решения команды (открытые вопросы)

| № | Вопрос | Почему важно | Кто решает |
|---|---|---|---|
| Q1 | **Продвижение шага черновика.** Закрыто 28.09.2026: URL и степпер пускают только уже достигнутый `current_step`; CTA («Подобрать решения» / «Перейти к симуляции» / принять вердикт) делает `openStep` на следующий, затем переход. Прямой URL дальше — редирект на текущий шаг. Правка, из-за которой подбор устарел, сжимает `current_step`: допущения шага 1 → «Параметры», «Параметры расчёта» → «Подбор». | **P0** — сделано | продукт + фронт |
| Q2 | **Проект без процесса.** В API у проекта ровно одна задача, поэтому `createDraft` без процесса берёт первую задачу локации. Подходит, или нужен черновик без задачи (бэк: `task_id` nullable)? | Окно A2 «Новый проект» из карточки локации | продукт + бэк |
| Q3 | **Поправки симуляции → экономика.** Сервис симуляции отдаёт `adjusted_input_set` (состав, калибровки). Пересчитывать ли экономику по принятым поправкам и как пользователь их принимает? | PRD 11.4–11.5: «после симуляции — принятые поправки» | продукт + бэк |
| Q4 | **Отмена прогона.** В services/simulation отмены нет; api только помечает прогон `cancelled`. Нужна ли настоящая отмена (`DELETE /api/simulations/jobs/{id}`)? | Воркер продолжает считать до 60 с | simulation |
| Q5 | **«Рейсы в час» и «загрузка» в «Параметрах расчёта»** сохраняются, но economics их не принимает. Нужны ли они во входе модели? | Правка на панели не меняет цифры — пользователь это заметит | economics |
| Q6 | **Параметры площадки `site_*` (PRD 10.6).** В API их нет: шаг 1 берёт определения из фикстуры `SITE_PARAMETERS`, значения — из параметров локации по совпадению кода, остальное «нет данных». Добавить их в датасет api? | Готовность шага 1 и проверки подбора | бэк |
| Q7 | **Сохранение без окупаемости** (`paybackYears = null`). Фронт по-прежнему запрещает; бэк разрешает. Оставить запрет? | PRD 11.5, открытый вопрос | продукт |
| Q8 | **Сервисный токен api → simulation.** Сейчас api пересылает токен пользователя (`aud` `rav5-sim`). Нужен ли `rav5-api-internal` для фоновых прогонов? | Прогоны без пользователя (seed, пересчёт) | бэк + DevOps |

## 2. Доделать в коде

### Фронт (`apps/web`)

- **P0 — Q1:** закрыто: CTA двигает `current_step`, URL дальше — редирект, устаревший подбор сжимает шаг. Тест «новый проект → подбор → симуляция» на моках.
- **P1 — прогон e2e и визуальных тестов** (`npm run test:e2e`, `npm run test:visual`) — после интеграции не запускались. Эталоны менять только осознанно.
- **P1 — e2e на живом стеке** (план, этап 5): Playwright-проект `e2e:stack` с `VITE_SERVICES=api`, роли гость / пользователь / админ. Сейчас живой сценарий есть только на уровне сервисов: [live.test.ts](../apps/web/src/services/api/live.test.ts).
- **P1 — ручная проверка экранов с `VITE_SERVICES=api`:** сервисы проверены тестами, экраны — нет. Кандидаты на расхождения: фото роботов (`photoUrl` в API пуст), характеристики позиций для запуска (только тип решения), совместимость позиций по названию, цифры «Параметров расчёта» при `0` по умолчанию.
- **P1 — сравнение решений:** [useCompareData.ts](../apps/web/src/pages/catalog/compare/useCompareData.ts) берёт демо-локацию `LOC-01` — в API такой id нет (ошибка поглощается). Взять демо-локацию из `GET /locations` (`isDemo`).
- **P1 — вход Keycloak не проверен вживую:** PKCE, `check-sso`, обновление токена, выход, 401 → вход; пересылка токена в simulation.
- **P2 — «Уточнения и проверки» дашборда** (PRD 8.3): в API нет, блок пустой ([overview.ts](../apps/web/src/services/api/overview.ts)).
- **P2 — бюджет бандла:** 296,4 из 300 КБ. Резерв — ленивая загрузка `src/services/api` только при `VITE_SERVICES=api`.
- **P2 — тесты `genApi` / `genSimulationFixtures` падают на Windows** из-за CRLF при checkout: добавить `eol=lf` для `src/api/generated/*` и `*.generated.ts` в `.gitattributes`.

### Бэкенд (`services/api`)

- **P1 — `required` у остальных схем** (`Project`, `Evaluation`, `CalcResult`, `Location`, `Task`): сейчас обязательность проверяют мапперы фронта. Фикстуры фронта придётся дополнить полями.
- **P1 — живой прогон на economics** (`ECONOMICS_TEST_URL`): новые пути (`calcOverrides`, `resultSummary`, симуляция) проверены на мок-модели.
- **P2 — эндпоинты, которые остались на моках:** документы локации (`POST/GET /locations/{id}/documents`), проверка ссылки источника (`POST /data-sources/check-url`), обновление каталога по запросу (A1а), фото робота.
- **P2 — список прогонов проекта** (`GET /projects/{id}/simulation-runs`): сейчас последний прогон знает только фронт (`inputs.simulation.runId`).

### Simulation (`services/simulation`)

- **P1 — схема трасс в `openapi.json`** по `simcore/viz.export_trace` (вопрос 6 в api-contract.md) и перегенерация `simulation.d.ts`.
- **P2 — отмена задания** (Q4).

## 3. DevOps (вне этой ветки)

- Пересобрать образ `api` в docker-compose: запущенный `rav5-api-1` собран до интеграции — новых эндпоинтов в нём нет.
- Шлюз: `/api/` → api и фронт с того же origin, что `/auth`.
- Сборка фронта: `VITE_SERVICES=api`, `VITE_API_BASE_URL`, `VITE_OIDC_URL`, `VITE_OIDC_CLIENT_ID=rav5-web`.
- Keycloak: redirect URI `http://localhost:5173/*` у клиента `rav5-web` для Vite dev.
- `SIMULATION_URL` у api в compose уже задан; при необходимости — `SIMULATION_TIMEOUT`.

## 4. Как проверить

```bash
# api локально: Postgres, seed, dev-режим, simulation
cd services/api
DATABASE_URL=... AUTH_DEV_MODE=true APP_ENV=local SIMULATION_URL=http://localhost:8765 go run ./cmd/api
go test ./... && TEST_DATABASE_URL=... go test -tags=integration ./internal/integration/

# сервисы фронта на живом api
cd apps/web
API_SMOKE_URL=http://localhost:8000 API_SMOKE_SIMULATION=1 npx vitest run src/services/api/live.test.ts
# экраны на api
VITE_SERVICES=api API_PROXY_TARGET=http://localhost:8000 npm run dev
```

## 5. Порядок

1. Ручная проверка экранов на API — без этого демо-сценарий не пройти.
2. Пересборка api в compose и настройка шлюза / Keycloak (DevOps), проверка входа.
3. e2e и визуальные тесты, e2e на живом стеке.
4. Живой прогон на economics, `required` в контракте, схема трасс.
5. Решения Q2–Q8 и P2-эндпоинты.
