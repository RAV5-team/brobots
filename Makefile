.DEFAULT_GOAL := help
COMPOSE      := docker compose
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml
SERVICES     := api simulation economics

.PHONY: help init up up-prod down clean build logs ps test test-api test-py shell psql

help: ## Список команд
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

init: ## Подготовить .env из шаблона
	@test -f .env || (cp .env.example .env && echo "создан .env — проверьте пароль базы")

up: init ## Поднять всё в режиме разработки
	$(COMPOSE) up --build

up-prod: init ## Поднять продовый контур в фоне
	$(COMPOSE_PROD) up --build -d

down: ## Остановить контейнеры
	$(COMPOSE) down

clean: ## Остановить и удалить тома (данные базы будут стёрты)
	$(COMPOSE) down --volumes --remove-orphans

build: ## Пересобрать образы без кеша
	$(COMPOSE) build --no-cache

logs: ## Логи всех сервисов (make logs s=api — одного)
	$(COMPOSE) logs -f $(s)

ps: ## Статус контейнеров
	$(COMPOSE) ps

test: test-api test-py ## Прогнать тесты всех сервисов

test-api: ## Тесты Go-сервиса api
	docker build -f services/api/Dockerfile --target test .

test-py: ## Тесты Python-сервисов
	@for s in simulation economics; do \
		echo "--- $$s ---"; \
		docker build -f services/$$s/Dockerfile --target test . || exit 1; \
	done

shell: ## Шелл внутри сервиса: make shell s=api
	$(COMPOSE) exec $(s) sh

psql: ## Консоль Postgres
	$(COMPOSE) exec postgres psql -U $$(grep ^POSTGRES_USER .env | cut -d= -f2) -d $$(grep ^POSTGRES_DB .env | cut -d= -f2)
