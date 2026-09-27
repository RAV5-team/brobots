#!/bin/sh
# Роли и пустые БД сервисов api, simulation и economics. Схемы создают миграции сервисов
# (goose в api при старте, alembic в контейнерах simulation-migrate и economics-migrate).
# Выполняется только на пустом томе: после смены пароля в .env нужен `docker compose down -v`.
set -eu

create_db() {
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v db="$1" -v role="$2" -v password="$3" <<-'EOSQL'
	CREATE ROLE :"role" LOGIN PASSWORD :'password';
	CREATE DATABASE :"db" OWNER :"role";
	-- К БД сервиса подключается только её владелец (и суперпользователь).
	REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
	EOSQL
}

create_db api "${API_DB_USERNAME:?}" "${API_DB_PASSWORD:?}"
create_db simulation "${SIM_DB_USERNAME:?}" "${SIM_DB_PASSWORD:?}"
create_db economics "${ECON_DB_USERNAME:?}" "${ECON_DB_PASSWORD:?}"
