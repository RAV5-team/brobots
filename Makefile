.DEFAULT_GOAL := help
COMPOSE       := docker compose
COMPOSE_STAND := docker compose -f docker-compose.yml -f docker-compose.stand.yml

.PHONY: help init secrets up up-stand down clean logs ps smoke psql

help: ## Список команд
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

init: ## Подготовить .env из шаблона (профиль local)
	@test -f .env || (cp .env.example .env && echo "создан .env из .env.example")

secrets: ## Сгенерировать случайные секреты в .env (для stand)
	./scripts/gen-secrets.sh

up: init ## Поднять Postgres + Keycloak + шлюз, профиль local (http://localhost/auth/)
	$(COMPOSE) up -d --build

up-stand: ## Поднять профиль stand (https, сертификат в infra/nginx/certs)
	$(COMPOSE_STAND) up -d --build

down: ## Остановить контейнеры
	$(COMPOSE) down

clean: ## Остановить и удалить тома: БД, realm и ключи Keycloak будут созданы заново
	$(COMPOSE) down --volumes --remove-orphans

logs: ## Логи (make logs s=keycloak — одного контейнера)
	$(COMPOSE) logs -f $(s)

ps: ## Статус контейнеров
	$(COMPOSE) ps

smoke: ## Smoke-тесты Keycloak и шлюза
	./scripts/auth-smoke.sh

psql: ## Консоль Postgres под суперпользователем (make psql db=keycloak)
	$(COMPOSE) exec postgres psql -U $$(grep ^POSTGRES_USER .env | cut -d= -f2) -d $(or $(db),postgres)
