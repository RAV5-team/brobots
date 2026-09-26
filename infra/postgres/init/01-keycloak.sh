#!/bin/sh
# Роль и пустая БД для Keycloak в общем Postgres. Схему Keycloak создаёт сам при старте.
# Выполняется только на пустом томе: после смены пароля в .env нужен `docker compose down -v`.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v role="${KC_DB_USERNAME:?}" -v password="${KC_DB_PASSWORD:?}" <<-'EOSQL'
	CREATE ROLE :"role" LOGIN PASSWORD :'password';
	CREATE DATABASE keycloak OWNER :"role";
	-- К БД keycloak подключается только её владелец (и суперпользователь).
	REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
	EOSQL
